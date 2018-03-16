const express = require('express')
const app = express()
var Congress = require( 'propublica-congress-node' );  
var client = new Congress('CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF');
app.use(express.static('public'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

app.get('/graphs/:billId', function (req, res) {
    res.send(req.params)
})

app.get('/testing', function (req, res) {
    var request = require('request');
    res.setHeader('Content-Type', 'application/json');

    //when requesting more https://stackoverflow.com/questions/32828415/how-to-run-multiple-async-functions-then-execute-callback
    var stuff = client.memberLists({congressNumber: '115', chamber: 'senate'}).then(function(value, boo=res) {
        console.log(value);
        boo.send(value);
        return value;
    })
})