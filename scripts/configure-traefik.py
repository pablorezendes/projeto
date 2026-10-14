#!/usr/bin/env python3
"""Infer this site's Traefik names from Docker without changing other stacks."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

FIELDS = {
    "TRAEFIK_NETWORK": ("network", "--network"),
    "TRAEFIK_HTTP_ENTRYPOINT": ("http", "--http"),
    "TRAEFIK_HTTPS_ENTRYPOINT": ("https", "--https"),
    "TRAEFIK_CERTRESOLVER": ("resolver", "--resolver"),
}
SAFE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")


class ConfigurationError(Exception):
    pass


def docker(*args: str) -> str:
    # Full inspection stays in memory. Never print environment values or secrets.
    result = subprocess.run(["docker", *args], capture_output=True, text=True)
    if result.returncode:
        raise ConfigurationError("Não foi possível consultar o Docker. Verifique se ele está ativo e acessível.")
    return result.stdout


def labels(container: dict) -> dict[str, str]:
    return {key.lower(): str(value) for key, value in (container.get("Config", {}).get("Labels") or {}).items()}


def networks(container: dict) -> set[str]:
    return set(container.get("NetworkSettings", {}).get("Networks") or {}) - {"bridge", "host", "none"}


def raw_static_flags(container: dict) -> dict[str, str]:
    config = container.get("Config", {})
    arguments = [*(config.get("Cmd") or []), *(container.get("Args") or [])]
    result: dict[str, str] = {}
    for index, argument in enumerate(arguments):
        if not isinstance(argument, str) or not argument.startswith("--"):
            continue
        key, separator, value = argument[2:].partition("=")
        if not separator:
            following = arguments[index + 1] if index + 1 < len(arguments) else ""
            value = following if isinstance(following, str) and not following.startswith("--") else "true"
        result[key] = value
    return result


def static_flags(container: dict) -> dict[str, str]:
    return {key.lower(): value for key, value in raw_static_flags(container).items()}


def certificate_resolvers(proxy: dict, https: str, references: set[str]) -> set[str]:
    # Environment decoding follows Traefik's parser: lowercase and '_' -> '.'.
    environment = {}
    for entry in proxy.get("Config", {}).get("Env") or []:
        key, separator, value = entry.partition("=")
        if separator and key.upper().startswith("TRAEFIK_"):
            environment[key[8:].lower().replace("_", ".")] = value
    raw_flags = raw_static_flags(proxy)
    declared = set()
    for key in [*raw_flags, *environment]:
        match = re.match(r"^certificatesresolvers\.([^.]+)\.acme(?:\.|$)", key, re.IGNORECASE)
        if match:
            declared.add(match[1])

    entrypoint_key = f"entrypoints.{https.lower()}.http.tls.certresolver"
    flags = {key.lower(): value for key, value in raw_flags.items()}
    entrypoint_resolver = flags.get(entrypoint_key, "") or environment.get(entrypoint_key, "")
    if entrypoint_resolver:
        if not SAFE_NAME.fullmatch(entrypoint_resolver):
            raise ConfigurationError("Nome inválido no certresolver do entrypoint HTTPS do Traefik.")
        if declared and entrypoint_resolver not in declared:
            raise ConfigurationError(
                "O certresolver do entrypoint HTTPS não corresponde a um resolvedor declarado "
                "nos argumentos ou no ambiente do Traefik. Consulte a configuração existente "
                "e informe --resolver NOME_EXATO."
            )
        return {entrypoint_resolver}

    if declared:
        # A stale application label cannot introduce an undeclared resolver.
        return (references & declared) or declared
    raise ConfigurationError(
        "Não foi possível confirmar um certresolver declarado nos argumentos ou no ambiente "
        "do Traefik selecionado. Se a configuração está em arquivo, consulte esse arquivo "
        "e informe --resolver NOME_EXATO ao executar scripts/configure-traefik.py. "
        "Labels das aplicações, sozinhas, não confirmam a existência do resolvedor."
    )


def routers(container: dict) -> list[dict[str, str]]:
    grouped: dict[str, dict[str, str]] = {}
    for key, value in labels(container).items():
        match = re.match(r"^traefik\.http\.routers\.([^.]+)\.(.+)$", key)
        if match:
            grouped.setdefault(match[1], {})[match[2]] = value
    return list(grouped.values())


def endpoints(router: dict[str, str]) -> set[str]:
    return {name.strip() for name in router.get("entrypoints", "").split(",") if name.strip()}


def uses_tls(router: dict[str, str]) -> bool:
    return router.get("tls", "").lower() == "true" or any(key.startswith("tls.") for key in router)


def is_traefik(container: dict) -> bool:
    config = container.get("Config", {})
    image = str(config.get("Image", "")).lower()
    commands = [*(config.get("Entrypoint") or []), *(config.get("Cmd") or [])]
    return bool(re.search(r"(?:^|/)traefik(?::|@|$)", image)) or any(
        Path(str(argument)).name == "traefik" for argument in commands
    )


def container_name(container: dict) -> str:
    return str(container.get("Name") or container.get("Id", "")[:12]).lstrip("/")


def choose(field: str, candidates: set[str], explicit: str = "") -> str:
    if explicit:
        if not SAFE_NAME.fullmatch(explicit):
            raise ConfigurationError(f"Valor inválido em {field}. Use o nome exato, sem espaços ou comandos.")
        return explicit
    candidates = {candidate for candidate in candidates if SAFE_NAME.fullmatch(candidate)}
    if len(candidates) == 1:
        return next(iter(candidates))
    option = FIELDS[field][1]
    found = ", ".join(sorted(candidates)) if candidates else "nenhum nome detectável"
    raise ConfigurationError(
        f"Não há uma escolha única para {field}: {found}. "
        f"Informe {option} NOME_EXATO ao executar scripts/configure-traefik.py."
    )


def published_entrypoints(proxy: dict, flags: dict[str, str], public_port: str) -> set[str]:
    ports = proxy.get("NetworkSettings", {}).get("Ports") or {}
    internal_ports = {
        port.split("/", 1)[0]
        for port, bindings in ports.items()
        if any(str(binding.get("HostPort")) == public_port for binding in bindings or [])
    }
    if proxy.get("HostConfig", {}).get("NetworkMode") == "host":
        internal_ports.add(public_port)
    result = set()
    for key, value in flags.items():
        match = re.match(r"^entrypoints\.([^.]+)\.address$", key)
        address = re.search(r":(\d+)(?:/(?:tcp|udp))?$", value)
        if match and address and address[1] in internal_ports:
            result.add(match[1])
    return result


def infer(containers: list[dict], values: dict[str, str], selected_container: str = "") -> dict[str, str]:
    if selected_container:
        proxies = [container for container in containers if container_name(container) == selected_container]
        if not proxies:
            proxies = [container for container in containers
                       if str(container.get("Id", "")).startswith(selected_container)]
    else:
        proxies = [container for container in containers if is_traefik(container)]
    if len(proxies) != 1:
        found = ", ".join(container_name(container) for container in proxies) or "nenhum contêiner Traefik identificado"
        raise ConfigurationError(
            f"Seleção do Traefik ambígua: {found}. "
            "Execute scripts/configure-traefik.py --container NOME_EXATO."
        )
    proxy = proxies[0]
    proxy_networks = networks(proxy)
    flags = static_flags(proxy)
    provider_network = flags.get("providers.docker.network", "")
    for entry in proxy.get("Config", {}).get("Env") or []:
        if entry.startswith("TRAEFIK_PROVIDERS_DOCKER_NETWORK=") and not provider_network:
            provider_network = entry.partition("=")[2]

    peers = [container for container in containers if container is not proxy
             and labels(container).get("traefik.enable", "").lower() != "false"
             and networks(container) & proxy_networks and routers(container)]
    referenced_networks = set()
    tls_networks = set()
    for peer in peers:
        common = networks(peer) & proxy_networks
        labeled = labels(peer).get("traefik.docker.network", "")
        if labeled in common:
            referenced_networks.add(labeled)
            common = {labeled}
        if any(uses_tls(router) for router in routers(peer)):
            tls_networks.update(common)
    network_candidates = ({provider_network} & proxy_networks) if provider_network else (
        referenced_networks or tls_networks or proxy_networks
    )
    network = choose("TRAEFIK_NETWORK", network_candidates, values.get("TRAEFIK_NETWORK", ""))
    if network not in proxy_networks:
        raise ConfigurationError(f"A rede {network} não está conectada ao Traefik selecionado.")

    # Only infer names from applications attached to this same proxy network.
    selected_peers = []
    for peer in peers:
        labeled = labels(peer).get("traefik.docker.network", "")
        if network in networks(peer) and (not labeled or labeled == network):
            selected_peers.append(peer)
    secure_routers = [router for peer in selected_peers for router in routers(peer) if uses_tls(router)]
    secure_endpoints = set().union(*(endpoints(router) for router in secure_routers)) if secure_routers else set()
    published_https = published_entrypoints(proxy, flags, "443")
    # A name from labels retains its exact case even when CLI keys use lower case.
    if published_https and secure_endpoints:
        published_https = {name for name in secure_endpoints if name.lower() in published_https} or published_https
    https = choose("TRAEFIK_HTTPS_ENTRYPOINT", published_https or secure_endpoints,
                   values.get("TRAEFIK_HTTPS_ENTRYPOINT", ""))

    http_endpoints = set()
    redirect_endpoints = set()
    for peer in selected_peers:
        peer_labels = labels(peer)
        for router in routers(peer):
            if uses_tls(router):
                continue
            http_endpoints.update(endpoints(router))
            for middleware in router.get("middlewares", "").split(","):
                name = middleware.strip().removesuffix("@docker").lower()
                if peer_labels.get(f"traefik.http.middlewares.{name}.redirectscheme.scheme", "").lower() == "https":
                    redirect_endpoints.update(endpoints(router))
    published_http = published_entrypoints(proxy, flags, "80")
    if published_http and http_endpoints:
        published_http = {name for name in http_endpoints if name.lower() in published_http} or published_http
    http = choose("TRAEFIK_HTTP_ENTRYPOINT", published_http or redirect_endpoints or (http_endpoints - {https}),
                  values.get("TRAEFIK_HTTP_ENTRYPOINT", ""))
    if http == https:
        raise ConfigurationError("Os entrypoints HTTP e HTTPS precisam ser distintos neste Compose.")

    resolver_references = {
        router["tls.certresolver"] for router in secure_routers
        if router.get("tls.certresolver") and (not endpoints(router) or https in endpoints(router))
    }
    resolver_candidates = certificate_resolvers(proxy, https, resolver_references) if not values.get(
        "TRAEFIK_CERTRESOLVER", ""
    ) else set()
    resolver = choose("TRAEFIK_CERTRESOLVER", resolver_candidates, values.get("TRAEFIK_CERTRESOLVER", ""))
    return {
        "TRAEFIK_NETWORK": network,
        "TRAEFIK_HTTP_ENTRYPOINT": http,
        "TRAEFIK_HTTPS_ENTRYPOINT": https,
        "TRAEFIK_CERTRESOLVER": resolver,
    }


def read_env(path: Path) -> tuple[str, dict[str, str]]:
    content = path.read_text(encoding="utf-8-sig") if path.exists() else ""
    values = {}
    for line in content.splitlines():
        match = re.match(r"^\s*([A-Z_]+)\s*=\s*(.*?)\s*$", line)
        if not match or match[1] not in FIELDS:
            continue
        value = match[2]
        if value.startswith(('"', "'")):
            closing = value.find(value[0], 1)
            if closing < 0 or (value[closing + 1:].strip() and not value[closing + 1:].lstrip().startswith("#")):
                raise ConfigurationError(f"Aspas inválidas em {match[1]} no .env.")
            value = value[1:closing]
        else:
            value = re.split(r"\s+#", value, maxsplit=1)[0].strip()
        values[match[1]] = value
    return content, values


def save_env(path: Path, content: str, values: dict[str, str]) -> None:
    remaining = set(values)
    lines = []
    for line in content.splitlines():
        match = re.match(r"^\s*([A-Z_]+)\s*=", line)
        if match and match[1] in values:
            lines.append(f"{match[1]}={values[match[1]]}")
            remaining.discard(match[1])
        else:
            lines.append(line)
    if not content:
        lines.append("# Nomes detectados no Traefik existente; nenhuma senha é armazenada aqui.")
    lines.extend(f"{key}={values[key]}" for key in FIELDS if key in remaining)
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=".deploy-env-", dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write("\n".join(lines) + "\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / ".env")
    parser.add_argument("--container", default="", help="Nome ou ID do contêiner Traefik, se houver mais de um")
    for attribute, option in FIELDS.values():
        parser.add_argument(option, dest=attribute, default="")
    args = parser.parse_args()
    try:
        content, existing = read_env(args.output)
        values = {key: getattr(args, attribute) or os.environ.get(key, "") or existing.get(key, "")
                  for key, (attribute, _) in FIELDS.items()}
        for key, value in values.items():
            if value and not SAFE_NAME.fullmatch(value):
                raise ConfigurationError(f"Valor inválido em {key}. Preencha somente o nome exato do Traefik.")
        if all(values.values()):
            # Explicit names are authoritative; preserve user configuration.
            if any(getattr(args, attribute) for attribute, _ in FIELDS.values()) or not args.output.exists():
                save_env(args.output, content, values)
            print("Configuração Traefik preenchida; nomes existentes preservados.")
            return 0
        identifiers = docker("ps", "--quiet").split()
        if not identifiers:
            raise ConfigurationError("Nenhum contêiner ativo encontrado no Docker.")
        containers = json.loads(docker("inspect", *identifiers))
        resolved = infer(containers, values, args.container)
        save_env(args.output, content, resolved)
        print("Configuração Traefik detectada e gravada em .env, sem alterar outros stacks.")
        return 0
    except (ConfigurationError, OSError, json.JSONDecodeError) as error:
        print(f"Configuração interrompida: {error}", file=sys.stderr)
        print("Nenhum stack foi alterado. Complete .env ou informe as opções explícitas e execute novamente.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
