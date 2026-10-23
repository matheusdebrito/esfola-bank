# Política de Armazenamento de Documentos

## Localização

Arquivos armazenados em disco local no diretório:
```
storage/clients/<client-id>/<aleatorio><extensao>
```

O diretório é montado como volume persistente no Docker Compose (`emprestimo_storage`).

## Nomenclatura

Nomes internos são aleatórios (16 bytes hexadecimais + extensão). Nunca usar nomes enviados pelo usuário como caminho de armazenamento (previne path traversal).

## Tipos e limites permitidos

- Tipos MIME: image/jpeg, image/png, application/pdf.
- Validação real de conteúdo via magic bytes (assinatura do arquivo).
- Tamanho máximo configurável via `MAX_FILE_SIZE_MB` (padrão 5 MB).

## Segurança

- O diretório de storage não é servido publicamente.
- Upload/download exigem autenticação e autorização (JWT cookie HttpOnly + permissões).
- Não retornar caminhos físicos do servidor nas respostas da API.
- Rate limiting nos endpoints de upload.
- Registro do usuário responsável pelo envio (auditoria).

## Integridade entre arquivo e metadados

- Gravação do arquivo e persistência dos metadados: se a gravação falhar, nenhum registro é criado.
- Se a gravação ocorrer mas a persistência falhar, o arquivo órfão é removido.
- Remoção de documento marca o registro como REJECTED (mantém trilha de auditoria) e remove o arquivo físico.

## Migração futura

A lógica de armazenamento está isolada em `StorageService`, permitindo migrar para serviço privado de objetos sem reescrever os módulos de clientes.
