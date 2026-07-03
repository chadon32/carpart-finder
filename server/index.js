// Local dev entry point. The actual Express app (routes + middleware) lives
// in api/index.js, which is also what Vercel deploys as a serverless
// function — this just runs that same app with a persistent listener.
import app from '../api/index.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`)
})
