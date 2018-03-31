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

app.get('/graphs/:congress/:bill/:vote', function (req, res) {
    res.setHeader('Content-Type', 'application/json')
    //console.log(req.params.bill, req.params.congress)
    ppc.getBill(req.params.bill, req.params.congress).then(function (value) {
        fs.writeFile('./public/data/billinfo.json', JSON.stringify(value), function (err) {
            if (err) throw err;
        });

        console.log('' + value.results[0].votes[req.params.vote].api_url)
        var str = ''+value.results[0].votes[req.params.vote].api_url;
        var arr = str.split("/");
        console.log(arr)
        //console.log(voteInfo)
        var nodes;
        ppc.getRollCallVotes(arr[6], arr[8], arr[10].replace('.json', ''), arr[5]).then(function(resp){
            //sort nodes by parties
            var sortedResp = resp.results.votes.vote.positions.sort(function(a, b) {
                return a.party.charCodeAt(0)-b.party.charCodeAt(0);
            })       
            
            //puts all of the members of congress in the circular formation and sets up the basic node
            for(var i = 0; i < sortedResp.length; i++) {
                var info = sortedResp[i]
                var cVal = '#ef3'
                if(info.party == 'R') {
                    cVal = '#f00'
                } else if (info.party == 'D') {
                    cVal = '#003'
                }
                var angle = i*Math.PI/sortedResp.length
                //coloring needs to reflect vote not party
                nodes.push({id: info.member_id, label: info.name, color: cVal, size:1, x: Math.cos(angle), y: Math.sin(angle)})
            }
            
            //make the special interest nodes (parties, donors)
            var topDoner = new Promise(function (resolve, reject) {
                var topIndustry = {}
                for (var i = 0; i < nodes.length; i++) {
                    var obj = JSON.parse(fs.readFileSync('./persistentdata' + nodes[i].id + '/' + req.params.congress +'.json', 'utf8'));
            
                    var response = sortedResp[i].vote_position;
                    if(response == 'Yes') {
                        topIndustry[obj.response.industries.industry[0].industry_name].yes++
                    } else if (response == 'No') {
                       topIndustry[obj.response.industries.industry[0].industry_name].no++
                    } else {
                        topIndustry[obj.response.industries.industry[0].industry_name].none++
                    }

                    topIndustry[obj.response.industries.industry[0].industry_name].x += nodes[i].x
                    topIndustry[obj.response.industries.industry[0].industry_name].y += nodes[i].y
                }

                for (var i = 0; i < Object.keys(topIndustry).length; i++) {
                    cIndustry = topIndustry[Object.keys(topIndustry)[i]]
                    total = cIndustry.yes + cIndustry.no + cIndustry.none
                    if (!(cIndustry.yes / total > .5 || cIndustry.no / total > .5 || cIndustry.none / total > .5)) {
                        delete topIndustry[Object.keys(topIndustry)[i]]
                    } else {
                        var cVal = '#f00'
                        if (cIndustry.yes / total > .5) {
                            cVal = '#0f0'
                        } else if (cIndustry.none / total > .5) {
                            cVal = '#222'
                        }
                        nodes.push({ id: topIndustry[Object.keys(topIndustry)[i]], label: topIndustry[Object.keys(topIndustry)[i]], color: cVal, size: 1, x: cIndustry.x/total, y: cIndustry.y/total}) //todo should change size
                    }
                }
                
                resolve(topIndustry)
            }).then(function(value) {
                fs.writeFile('./public/data/nodes.json', JSON.stringify(nodes), function (err) {
                    if (err) throw err;
                });
            })

            //res.send(nodes)
        })
        //res.send(value)
        res.redirect('../../../graph.html')
    })
})

var openResponse;
var proResponse;

app.get('/datarefresh', function (req, res) {
    res.setHeader('Content-Type', 'application/json');

    recieveData(112)
    recieveData(113)
    recieveData(114)
    recieveData(115)

    res.redirect('../index.html')
})

function recieveData(congress) {
    var first = ppc.getMemberList('house', congress)
    var firstS = ppc.getMemberList('senate', congress)
    var overall = {}
    Promise.all([first, firstS]).then(function (valAr) {
        console.log('1')
        for (var a = 0; a < valAr.length; a++) {
            value = valAr[a].results['0'].members
            for (var i = 0; i < value.length; i++) {               
                overall[value[i].id] = value[i]
            }
        }
    }).then(function (value) {
        console.log('2')
        for (var i = 0; i < Object.keys(overall).length; i++) {
            console.log(overall[Object.keys(overall)[i]].id)
            writingCallback(i, overall[Object.keys(overall)[i]], congress)
        }
    })
}
function writingCallback(pos, overallData, congress) {
    var localClient = new OpenSecretsClient(opKeys[pos%8]);
    console.log('crp_id '+ overallData.crp_id)

    var year = 2018
    if(congress == 112){
        year = 2012
    } else if (congress == 113) {
        year = 2014
    } else if (congress == 114) {
        year = 2016
    }

    localClient.makeRequest('candIndustry', { cid: overallData.crp_id, cycle: year, output: 'json'})
    .on('complete', function (input) {
        if (input instanceof Error) console.log('Something went wrong');
        console.log('3xx '+ pos + ' '+ overallData)
        val = verifiedJSON(input)
        if(!val.bad) {
            overallData = mergeJSON.merge(overallData, JSON.parse(input))
        } else {
            console.log('bad id was '+ overallData.id +' crp: '+ overallData.crp_id)
        } 
        fs.writeFile('./persistentdata/' + overallData.id + '.' + congress + '.json', JSON.stringify(overallData), function (err) {
            if (err) throw err;
        });
    })

    console.log('finished process')
}

function verifiedJSON(val) {
    var a;
    try {
        a = JSON.parse(val);
    } catch (e) {
        console.log('caught'); // error in the above string (in this case, yes)!
        a = {bad:true}
    } finally {
        return a
    }
}

app.get('/testing', function (req, res) {
    res.setHeader('Content-Type', 'application/json');

    var first = ppc.getCurrentSenators('NY')

    var second = new Promise((resolve, reject) => {
        clientO.makeRequest('candIndustry', { cid: 'N00000286', cycle:2014, output: 'json' })
            .on('complete', function (res) {
                if (res instanceof Error) console.log('Something went wrong');
                console.log(res)
                val = verifiedJSON(res)

                resolve(val)
            })
    });
    Promise.all([first, second]).then(function (value, boo = res) {
        console.log(value[1])
        if(value[1].bad) {
            boo.send(value[0])
        } else {
            var ans = mergeJSON.merge(JSON.parse(JSON.stringify(value[0])), JSON.parse(JSON.stringify((value[1]))))
            
            boo.send(ans)
        }
    })
})