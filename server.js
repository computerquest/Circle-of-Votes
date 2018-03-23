const express = require('express')
const app = express()
var Congress = require( 'propublica-congress-node' );  
var clientC = new Congress('CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF');
var OpenSecretsClient = require('opensecrets-client', 'json');
var clientO = new OpenSecretsClient('8fad4c535bd7763204689b57c70137fd ');
var util = require("util")
app.use(express.static('public'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

app.get('/graphs/:billId', function (req, res) {
    res.send(req.params)
})

var openResponse;
var proResponse;
app.get('/testing', function (req, res) {
    var request = require('request');
    res.setHeader('Content-Type', 'application/json');

    //when requesting more https://stackoverflow.com/questions/32828415/how-to-run-multiple-async-functions-then-execute-callback
    var first = new Promise((resolve, reject) => {
        var resp = clientC.memberVotePositions({ memberId: 'R000558' })
        console.log(resp)
        resolve(resp)
    })

    var s = "stuff"
    var oResp;
    var second = new Promise((resolve, reject) => {
        resolve(clientO.makeRequest('getLegislators', { id: 'N00004357', output: 'json' })
            .on('complete', function (res) {
                if (res instanceof Error) console.log('Something went wrong');

                processOS(res)
            })
    )});

    /*clientO.makeRequest('getLegislators', { id: 'N00004357', output: 'json'})
    .on('complete', function(res) {
      if (res instanceof Error) console.log('Something went wrong');
      
      console.log(res);
    });*/

    Promise.all([first, second]).then(function (value, boo = res) {
        //console.log(value[1])
        boo.send(util.inspect(value[1]))
        return value;
    })
})

function processC(data) {
    proResponse = data;
    console.log(proResponse)
}

function processOS(data) {
    openResponse = data;
    //console.log(openResponse)
}