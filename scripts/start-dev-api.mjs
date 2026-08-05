// Keep the project API on its own development port. This prevents another
// local app on the common 3001 port from returning HTML to the Vite proxy.
process.env.PORT = process.env.CPF_API_PORT || '3002'
await import('../server/index.js')
