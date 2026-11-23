import "dotenv/config";
import { app } from "./app";

const port = 3000;

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
