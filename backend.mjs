import express from "express"
import { Schedule } from "./schedule.mjs"
import { Settings } from "./settings.mjs"
import { Shul } from "./shul.mjs"

let shul = new Shul("Test Shul", [], [], null, "testshul.org", "testshul.org/contribute", new Settings(5786));
let schedule = new Schedule(new Settings(5786));
shul.setSchedule(schedule);

const app = express()
const port = 3000

app.get("/api/shul", (req, res) => {
  res.json(shul.getShulData());
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})