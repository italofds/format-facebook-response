const express = require('express');
const multer = require('multer');
const processFile = require('../controllers/file.controller.js')

const router = express.Router();
const upload = multer();

router.post('/file', upload.single('file'), processFile);

module.exports = router;