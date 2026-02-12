require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

const app = express();
app.use(cors());
app.use(express.json());
ffmpeg.setFfmpegPath(ffmpegPath);

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

/* ================= USER MODEL ================= */

const userSchema = new mongoose.Schema({
  email:String,
  password:String,
  role:{type:String,default:"free"},
  videosUsed:{type:Number,default:0},
  lastReset:{type:Date,default:Date.now}
});

const User = mongoose.model("User",userSchema);

/* ================= REGISTER ================= */

app.post("/register",async(req,res)=>{
  const {email,password} = req.body;
  const hashed = await bcrypt.hash(password,10);
  const user = new User({email,password:hashed});
  await user.save();
  res.json({message:"Registered"});
});

/* ================= LOGIN ================= */

app.post("/login",async(req,res)=>{
  const {email,password} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.status(400).json({message:"User not found"});

  const match = await bcrypt.compare(password,user.password);
  if(!match) return res.status(400).json({message:"Wrong password"});

  const token = jwt.sign(
    {id:user._id},
    process.env.JWT_SECRET,
    {expiresIn:"7d"}
  );

  res.json({token});
});

/* ================= AUTH ================= */

const auth = async(req,res,next)=>{
  const token = req.headers.authorization;
  if(!token) return res.status(401).json({message:"No token"});
  const decoded = jwt.verify(token,process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id);
  next();
};

/* ================= PROCESS VIDEO ================= */

const upload = multer({dest:"uploads/"});

app.post("/process",auth,upload.single("video"),async(req,res)=>{
  const input = req.file.path;
  const output = "output-"+Date.now()+".mp4";

  ffmpeg(input)
  .videoFilters("hqdn3d=1.5:1.5:6:6,scale=1920:1080,unsharp=5:5:1.1")
  .videoCodec("libx264")
  .outputOptions(["-b:v 14M","-preset veryfast"])
  .save(output)
  .on("end",()=>{
    res.download(output);
  });
});

app.listen(5000,()=>console.log("Server Running"));
