const express = require("express")
const cors = require("cors")

const app = express();


app.use(cors());
app.use(express.json());

const userRoutes = require("./routes/userRoutes");

app.use("/api", userRoutes);

// const pool = require("./config/db");

// pool.query("SELECT NOW()", (err, res) => {
//     if (err) {
//         console.error(err);
//     } else {
//         console.log(res.rows);
//     }
// });


app.listen(5000, () => {
    console.log("Server running on port 5000");
});