import express from "express";
import scheduleRouter from "./routes/schedule.mjs";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use("/api/schedule", scheduleRouter);

app.get("/", (req, res) => {
    res.send("Backend running");
});

app.listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
});