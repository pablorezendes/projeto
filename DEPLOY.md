# Implantação da apresentação

O repositório contém a apresentação comercial do AURION e a infraestrutura do site. Desenhos de fabricação, arquivos de corte, listas de peças e instruções de montagem não fazem parte desta distribuição.

## Servidor Docker com Traefik existente

No diretório `/srv/stack/projeto`, obtenha este repositório e execute o script. Ele detecta os nomes existentes do Traefik pelos contêineres ativos e grava `.env` somente quando há uma escolha única. A rede deve existir. Nenhum nome é presumido e nenhuma porta do host é publicada.

```bash
cd /srv/stack/projeto
git clone https://github.com/pablorezendes/projeto.git .
bash scripts/deploy.sh
```

Se houver mais de um Traefik, rede ou resolvedor possível, o script interrompe antes de alterar o site e informa qual campo está ambíguo. Use os nomes exatos da infraestrutura existente:

Para certificados, o detector prioriza o resolvedor configurado no entrypoint HTTPS e os nomes declarados nos argumentos ou no ambiente do Traefik ativo. Referências antigas nas labels das aplicações não acrescentam nomes candidatos. Se a configuração do Traefik estiver em arquivo, consulte esse arquivo e informe `--resolver NOME_EXATO`; o detector não presume que uma label corresponde a um resolvedor existente.

```bash
python3 scripts/configure-traefik.py --container NOME_DO_TRAEFIK --network REDE_EXISTENTE --http ENTRYPOINT_HTTP --https ENTRYPOINT_HTTPS --resolver CERTRESOLVER
bash scripts/deploy.sh
```

Também é possível copiar `.env.example` para `.env` e preencher os quatro nomes manualmente. Campos já preenchidos são preservados. O detector consulta o Docker em memória e não imprime senhas, tokens nem variáveis dos outros serviços.

O DNS de `projeto.tescod.com` deve apontar para o servidor que executa o Traefik. Se houver registro AAAA, ele também deve apontar para esse servidor e o HTTPS precisa estar acessível por IPv6.

O script valida o Compose, constrói uma imagem exclusiva, verifica o Nginx e aguarda a saúde do contêiner. Se a nova versão falhar, restaura a imagem anterior. As operações ficam limitadas ao projeto Compose `projeto-apice`.

## Atualizações

```bash
cd /srv/stack/projeto
git pull --ff-only
bash scripts/deploy.sh
```

O site serve somente `public/`. O `.env`, os scripts e este guia não entram na imagem. O processo roda sem root, com sistema de arquivos somente leitura e sem acesso ao socket Docker. O certificado e o redirecionamento HTTP para HTTPS ficam no Traefik.

Referências: [imagem oficial Nginx](https://hub.docker.com/_/nginx), [rótulos Docker do Traefik](https://doc.traefik.io/traefik/reference/routing-configuration/other-providers/docker/), [variáveis do Compose](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).
