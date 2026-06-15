import express from "express"
import { Schedule } from "./schedule.mjs"
import { Settings } from "./settings.mjs"

let schedule = new Schedule(new Settings(5786));

const app = express()
const port = 3000

app.get("/api/schedule", (req, res) => {
  res.json(schedule.getScheduleData());
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})