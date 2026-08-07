const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");

router.post(
    "/upload-images",
    upload.array("images",10),
    (req,res)=>{

        console.log("Route Hit");

        console.log(req.files);

        res.json({
            success:true
        });

    }
)

module.exports = router;