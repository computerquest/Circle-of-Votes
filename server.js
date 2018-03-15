const express = require('express')
const app = express()

app.use(express.static('public'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

app.get('/graphs/:billId', function (req, res) {
    res.send(req.params)
})

app.get('/testing', function (req, res) {
    var request = require('request');
    res.setHeader('Content-Type', 'application/json');
    request.get('https://www.gpo.gov/fdsys/bulkdata/BILLSTATUS/115/s/BILLSTATUS-115s998.xml', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var parser = require('xml2json');
            res.send(parser.toJson(body))
        }
    });
})