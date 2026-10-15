# ÁPICE — apresentação do produto

Apresentação pública do conceito ÁPICE P1 para investidores.

Inclui imagens finais, uma visualização 3D conceitual de aparência, dimensões gerais e possibilidades comerciais. O acervo de engenharia, os manuais, as listas de corte e os arquivos de fabricação não fazem parte deste repositório.

## Executar localmente

Requer Node.js 22 ou mais recente.

```sh
npm ci
npm run check
npm run dev
```

O visualizador já está compilado. Para recompilá-lo após mudanças nos módulos de `src/`, use `npm run build:modelo`.

## Publicar

A implantação usa Docker e o Traefik existente. Consulte [DEPLOY.md](DEPLOY.md). Apenas a pasta `public/` e a configuração do Nginx são copiadas para a imagem.

Destino: `https://projeto.tescod.com`.

## Direitos

© 2026 ÁPICE. Todos os direitos reservados. A publicação deste repositório não concede licença para reutilizar as imagens, a marca ou os elementos autorais do projeto. Dependências de terceiros conservam suas próprias licenças.

A figura humana digital e suas texturas usam dados MakeHuman CC0, documentados em `public/modelo/assets/HUMAN-LICENSE.txt`. Essa licença se limita ao personagem e não se estende ao design do ÁPICE. Os símbolos são apresentados como imagens de aparência; arquivos de corte e fabricação continuam excluídos.

O produto é apresentado como conceito em fase de protótipo P1. Não há alegação de cura, certificação concluída ou desempenho comercial validado.
