const express = require('express')
var Congress = require('propublica-congress-node');   //maximum of 5000 calls per day
var OpenSecretsClient = require('opensecrets-client', 'json'); //maximum of 200 calls per day
var util = require("util")
var request = require('request');
var mergeJSON = require("merge-json");
var fs = require('fs');

const app = express()
ppc = require('propublica-congress').create('CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF');
var clientO = new OpenSecretsClient('8fad4c535bd7763204689b57c70137fd'); //the json values are returned as a string

var opKeys = ['8fad4c535bd7763204689b57c70137fd', 'd54dbd5a4f572862c2609aab9487a365', 'f8cea77db428d13c088ac8afff35e519', 'be091217e1dd3b340e2511e38699efa7', 'db37558aa3f970cadfb8345c26d1dde6','5928e99d96fac2a30906a126a293714d', '1ad00b500ae4d8a0a3333c7e1689eebb', 'c29969ede23d4f4871205c97548a8290', '2d87571b3707af874843d8e9f3391666']

app.use(express.static('public'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

app.get('/graphs/:billId', function (req, res) {
    res.send(req.params)
})

var openResponse;
var proResponse;

app.get('/datarefresh', function (req, res) {
    res.setHeader('Content-Type', 'application/json');

    var overallData = {}
    var first = ppc.getMemberList('house', 115)
    var firstS = ppc.getMemberList('senate', 115)

    var second = ppc.getMemberList('house', 114)
    var secondS = ppc.getMemberList('senate', 114)

    var third = ppc.getMemberList('house', 113)
    var thirdS = ppc.getMemberList('senate', 113)

    //this retrieves all the general infromation for congress people for the last 3 congresses
    Promise.all([first, firstS, second, secondS, third, thirdS]).then(function(valAr, overall=overallData, resp=res) {
        console.log('1')
        for(var a = 0; a < valAr.length; a++) {
            value = valAr[a].results['0'].members
            for(var i = 0; i < value.length; i++) {
                if(overall[value[i].id] != undefined) {
                    continue
                } else {
                    overall[value[i].id] = value[i]
                }
            }
        }
    }).then(function(value) {
        console.log('2')
        for(var i = 0; i < Object.keys(overallData).length; i++) {
            var key = i%8
            var localClient = new OpenSecretsClient(opKeys[key]);
            console.log(overallData[Object.keys(overallData)[i]].crp_id) 
            writingCallback(i, overallData[Object.keys(overallData)[i]])
        }

        //res.send(JSON.parse(JSON.stringify(overallData)))
    })/*.then(function(resp) {
        console.log('3')
        for(var i = 0; i < Object.keys(overallData).length; i++) {
            fs.writeFile('./persistentdata/'+Object.keys(overallData)[i]+'.json', JSON.stringify(overallData[Object.keys(overallData)[i]]), { flag: 'w', encoding:'utf8' }, function (err) {
                if (err) throw err;
            });
        }  
        res.send(JSON.parse(JSON.stringify(overallData)))
    })*/
})

function writingCallback(pos, overallData) {
    clientO.makeRequest('candIndustry', { cid: overallData.crp_id, output: 'json' })
    .on('complete', function (input) {
        if (input instanceof Error) console.log('Something went wrong');
        console.log('3xx '+ pos + ' '+ overallData)
        if (input instanceof Error) console.log('Something went wrong');
        overallData = mergeJSON.merge(overallData, JSON.parse(input))
        fs.writeFile('./persistentdata/'+ overallData.id+'.json', JSON.stringify(overallData), { flag: 'w', encoding:'utf8' }, function (err) {
            if (err) throw err;
        });
    })
}
app.get('/testing', function (req, res) {
    res.setHeader('Content-Type', 'application/json');

    var first = ppc.getCurrentSenators('NY')

    var second = new Promise((resolve, reject) => {
        clientO.makeRequest('candIndustry', { cid: 'N00004357', output: 'json' })
            .on('complete', function (res) {
                if (res instanceof Error) console.log('Something went wrong');
                resolve(res)
            })
    });
    Promise.all([first, second]).then(function (value, boo = res) {
        var ans =  mergeJSON.merge(JSON.parse(JSON.stringify(value[0])), JSON.parse(value[1]))
        
        boo.send(ans)
    })
})