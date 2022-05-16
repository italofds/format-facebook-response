const express = require('express');
const path = require('path');
const routes = require('./routes/main.route');

const app = express();
const port = process.env.PORT || 8080;

app.use(routes);
app.use(express.static(__dirname));
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'pages/index.html'));
});

app.listen(port);
console.log('Server started at http://localhost:' + port);