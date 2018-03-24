const express = require('express')
const app = express()
var Congress = require('propublica-congress-node');  
var OpenSecretsClient = require('opensecrets-client', 'json');
var util = require("util")
var XLSX = require('xlsx')
var request = require('request');

var clientC = new Congress('CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF');
var clientO = new OpenSecretsClient('8fad4c535bd7763204689b57c70137fd ');

app.use(express.static('public'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

app.get('/graphs/:billId', function (req, res) {
    res.send(req.params)
})

var openResponse;
var proResponse;
app.get('/testing', function (req, res) {
    res.setHeader('Content-Type', 'application/json');

    //when requesting more https://stackoverflow.com/questions/32828415/how-to-run-multiple-async-functions-then-execute-callback
    var first = new Promise((resolve, reject) => {
        var resp = clientC.memberVotePositions({ memberId: 'R000570' })
        resolve(resp)
    })

    var second = new Promise((resolve, reject) => {
        var external;
        var workbook = XLSX.readFile('crpid.xls');
        var returnedJson = XLSX.utils.sheet_to_json(workbook.Sheets['Candidate IDs - 2016']);
        resolve(JSON.parse(JSON.stringify(returnedJson)))
        clientO.makeRequest('candSummary', { id: 'N00004357', output: 'json' })
            .on('complete', function (res) {
                if (res instanceof Error) console.log('Something went wrong');
                //resolve(res)
            })
    });

    Promise.all([first, second]).then(function (value, boo = res) {
        console.log(value[0])
        console.log(value[1])
        boo.send(JSON.parse(JSON.stringify(value[0])))
    })
})