const express = require('express')
var Congress = require('propublica-congress-node');   //maximum of 5000 calls per day
var OpenSecretsClient = require('opensecrets-client', 'json'); //maximum of 200 calls per day
var util = require("util")
var request = require('request');
var mergeJSON = require("merge-json");
var fs = require('fs');
var net = require('net'),
JsonSocket = require('json-socket');
var mustacheExpress = require('mustache-express');

const app = express()
app.set('view engine', 'mustache')
app.engine('mustache', mustacheExpress());
app.set('views', __dirname + '/public'); // you can change '/views' to '/public',
ppc = require('propublica-congress').create('CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF');
var clientO = new OpenSecretsClient('8fad4c535bd7763204689b57c70137fd'); //the json values are returned as a string

var opKeys = ['8fad4c535bd7763204689b57c70137fd', 'd54dbd5a4f572862c2609aab9487a365', 'f8cea77db428d13c088ac8afff35e519', 'be091217e1dd3b340e2511e38699efa7', 'db37558aa3f970cadfb8345c26d1dde6','5928e99d96fac2a30906a126a293714d', '1ad00b500ae4d8a0a3333c7e1689eebb', 'c29969ede23d4f4871205c97548a8290', '2d87571b3707af874843d8e9f3391666']

app.use(express.static('public'))

app.listen(3000, () => console.log('Example app listening on port 3000!'))

app.get('/graphs/:congress/:bill/:vote', function (req, res) {
    console.log('starting')
    res.setHeader('Content-Type', 'text/html')
    ppc.getBill(req.params.bill, req.params.congress).then(function (value) {
        console.log('bil')
        fs.writeFile('./public/data/billinfo.json', JSON.stringify(value), function (err) {
            if (err) throw err;
        });

        console.log(req.url)

        var str = ''+value.results[0].votes[req.params.vote].api_url;
        console.log(str)
        var arr = str.split("/");
        var nodes = [];
        var edges = []
        var members = {}
        ppc.getRollCallVotes(arr[6], arr[8], arr[10].replace('.json', ''), arr[5]).then(function(resp){
            console.log('votes')
            //sort nodes by parties
            var sortedResp = resp.results.votes.vote.positions.sort(function(a, b) {
                return a.party.charCodeAt(0)-b.party.charCodeAt(0);
            })       
            
            //puts all of the members of congress in the circular formation and sets up the basic node
            var party = {}
            for(var i = 0; i < sortedResp.length; i++) {
                var info = sortedResp[i]
                var cVal = '#ffff33'
                members[info.member_id] = { vote: info.vote_position, party: info.party, voteShown: false }
                if(typeof party[info.party] === 'undefined') {
                    party[info.party] = {x: 0, y: 0, memberid:[], name: info.party, yes: 0, no: 0, none: 0}
                }
                party[info.party].memberid.push(info.member_id)
                
                if (info.vote_position == 'Yes') {
                    party[info.party].yes++
                } else if (info.vote_position == 'No') {
                    party[info.party].no++
                } else {
                    party[info.party].none++
                }

                if(info.party == 'R') {
                    cVal = '#ff3333'
                } else if (info.party == 'D') {
                    cVal = '#3333ff'
                }

                var angle = 2*i*Math.PI/sortedResp.length

                x = Math.cos(angle)
                y = Math.sin(angle)

                party[info.party].x += x
                party[info.party].y += y
                //coloring needs to reflect vote not party
                nodes.push({id: info.member_id, label: info.name, color: cVal, size: 1, x: x, y: y})
            }
             
            //make the special interest nodes (parties, donors)
            var topIndustry = {}
            for (var i = 0; i < nodes.length; i++) {
                var obj = JSON.parse(fs.readFileSync('./persistentdata/' + nodes[i].id + '.' + req.params.congress +'.json', 'utf8'));
                
                var response = sortedResp[i].vote_position;

                if(typeof obj.response === 'undefined') {
                    continue
                }

                var key = obj.response.industries.industry[0]['@attributes'].industry_name
                if (typeof topIndustry[key] === 'undefined') {
                    topIndustry[key] = {}
                    topIndustry[key].name = key 
                    topIndustry[key].yes = 0
                    topIndustry[key].no = 0
                    topIndustry[key].none = 0
                    topIndustry[key].x = 0
                    topIndustry[key].y = 0
                    topIndustry[key].memberid = []
                }

                if(response == 'Yes') {
                    topIndustry[key].yes++
                } else if (response == 'No') {
                    topIndustry[key].no++
                } else {
                    topIndustry[key].none++
                }

                topIndustry[key].x += nodes[i].x
                topIndustry[key].y += nodes[i].y

                topIndustry[key].memberid.push(obj.id)
            }

            nodes.push({ id: 'main', label: req.params.bill, color: '#fff', x: 0, y: 0, size: 3, color: ((resp.results.votes.vote.result == 'Motion Rejected')? '#f00': '#0f0')})
            //nodes.push({ id: 'main1', label: 'bill', color: '#000', x: 1, y: 0, size: 3 })
            //nodes.push({ id: 'main2', label: 'bill', color: '#000', x: 0, y: 1, size: 3 })
            //nodes.push({ id: 'main3', label: 'bill', color: '#000', x: -1, y: 0, size: 3 })
            //nodes.push({ id: 'main4', label: 'bill', color: '#000', x: 0, y: -1, size: 3 })

            //add party nodes
            for(var i = 0; i < Object.keys(party).length; i++) {
                var current = party[Object.keys(party)[i]] 
                var total = current.yes + current.no + current.none

                if(current.yes/total > .5) {
                    party[Object.keys(party)[i]].vote = 'Yes'
                } else if (current.no / total > .5) {
                    party[Object.keys(party)[i]].vote = 'No'
                } else if (current.none / total > .5) {
                    party[Object.keys(party)[i]].vote = 'Note Voting'
                } else {
                    delete party[Object.keys(party)[i]]
                    continue
                }

                cVal = '#ffff00'
                if (Object.keys(party)[i] == 'R') {
                    cVal = '#ff0000'
                } else if (Object.keys(party)[i] == 'D') {
                    cVal = '#0000ff'
                }
                nodes.push({ id: Object.keys(party)[i], label: Object.keys(party)[i], color: cVal, size: 2, x: current.x / total, y: current.y / total }) //todo should change size
            }

            //add industry nodes
            for (var i = 0; i < Object.keys(topIndustry).length; i++) {
                cIndustry = topIndustry[Object.keys(topIndustry)[i]]
                total = cIndustry.yes + cIndustry.no + cIndustry.none

                if (total<2||!(cIndustry.yes / total > .5 || cIndustry.no / total > .5 || cIndustry.none / total > .5)){//} || total < 2) {
                    delete topIndustry[Object.keys(topIndustry)[i]]
                    i--
                    continue
                } else {
                    topIndustry[Object.keys(topIndustry)[i]].vote = 'No'
                    if (cIndustry.yes / total > .5) {
                        topIndustry[Object.keys(topIndustry)[i]].vote = 'Yes'
                    } else if (cIndustry.none / total > .5) {
                        topIndustry[Object.keys(topIndustry)[i]].vote = 'Not Voting'
                    }
                    var x = cIndustry.x / total
                    var y = cIndustry.y / total
                    //var angle = Math.atan(y/x)
                    /*if(Math.sqrt(Math.pow(Math.cos(angle)-x, 2)+Math.pow(Math.sin(angle)-y, 2)) < .1) {
                    console.log(Object.keys(topIndustry)[i], x, y, -Math.cos(angle) * .1 * (Math.abs(x) / x), -Math.sin(angle) * .1 * (Math.abs(y) / y))
                        x += -Math.cos(angle)*.1*(Math.abs(x)/x)
                       y += -Math.sin(angle) * .1 * (Math.abs(y) / y)
                        console.log(x,y)
                   } */                   
                    nodes.push({ id: Object.keys(topIndustry)[i], label: Object.keys(topIndustry)[i], color: '#009933', size: 2, x: x, y: y}) //todo should change size
                }
            }

            //members to industry
            for (var i = 0; i < Object.keys(topIndustry).length; i++) {
                currentIndustry = topIndustry[Object.keys(topIndustry)[i]].memberid
                for(var a = 0; a < currentIndustry.length; a++) {  
                    if (members[currentIndustry[a]].vote == topIndustry[Object.keys(topIndustry)[i]].vote) {    
                        members[currentIndustry[a]].voteShown = true
                        edges.push({ id: 'e' + currentIndustry[a] + '.' + Object.keys(topIndustry)[i], source: currentIndustry[a], target: Object.keys(topIndustry)[i], color: '#00b33c'})
                    }
                }
            }

            //industry to center
            for (var i = 0; i < Object.keys(topIndustry).length; i++) {
                var cVal = '#f00'
                if (topIndustry[Object.keys(topIndustry)[i]].vote == 'Yes') {
                    cVal = '#0f0'
                } else if (topIndustry[Object.keys(topIndustry)[i]].vote == 'Not Voting') {
                    continue
                }
                edges.push({ id: 'e' + Object.keys(topIndustry)[i] + '.main', target: 'main', source: Object.keys(topIndustry)[i], color: cVal })
            }

            //members to party
            for (var i = 0; i < Object.keys(party).length; i++) {
                currentIndustry = party[Object.keys(party)[i]].memberid
                
                cVal = '#ffff80'
                if (Object.keys(party)[i] == 'D') {
                    cVal = '#99b3ff'
                } else if (Object.keys(party)[i] == 'R') {
                    cVal = '#ff8080'
                }

                for (var a = 0; a < currentIndustry.length; a++) {
                    if (members[currentIndustry[a]].vote == party[Object.keys(party)[i]].vote && members[currentIndustry[a]].voteShown == false) {               
                        members[currentIndustry[a]].voteShown = true
                        edges.push({ id: 'e' + currentIndustry[a] + '.' + Object.keys(party)[i], source: currentIndustry[a], target: Object.keys(party)[i], color: cVal})
                    }
                }
            }

            //party to center
            for (var i = 0; i < Object.keys(party).length; i++) {
                var cVal = '#f00'
                if (party[Object.keys(party)[i]].vote == 'Yes') {
                    cVal = '#0f0'
                } else if (party[Object.keys(party)[i]].vote == 'Not Voting') {
                    continue
                }
                edges.push({ id: 'e' + Object.keys(party)[i] + '.main', target: 'main', source: Object.keys(party)[i], color: cVal })
            }

            //need to do party to center
            //members to center
            for (var i = 0; i < Object.keys(members).length; i++) {
                current = members[Object.keys(members)[i]]
                if(!current.voteShown && current.vote != "Not Voting") {
                    var cVal = '#f00'
                    if (current.vote == 'Yes') {
                        cVal = '#0f0'
                    } else if (current.vote == 'None') {
                        cVal = '#222'
                    }
                    edges.push({ id: 'e' + Object.keys(members)[i] + '.main', target: 'main', source: Object.keys(members)[i], color: cVal })
                }
            }
        }).then(function(value) {
            solution = { "nodes": nodes, "edges": edges }

            console.log('loading the file.....')
            res.render('graph.mustache', { data: JSON.stringify(solution) })
        })
    })
})

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
        for (var a = 0; a < valAr.length; a++) {
            value = valAr[a].results['0'].members
            for (var i = 0; i < value.length; i++) {               
                overall[value[i].id] = value[i]
            }
        }
    }).then(function (value) {
        for (var i = 0; i < Object.keys(overall).length; i++) {
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