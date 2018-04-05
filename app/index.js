const express = require('express')
var OpenSecretsClient = require('opensecrets-client', 'json'); //maximum of 200 calls per day
var mergeJSON = require("merge-json");
var fs = require('fs');
var mustacheExpress = require('mustache-express');
ppc = require('propublica-congress').create('CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF');
var parseString = require('xml2js').parseString;
var xml = "<root>Hello xml2js!</root>"
const request = require('request');

const app = express()
app.set('view engine', 'mustache')
app.engine('mustache', mustacheExpress());
app.set('views', __dirname + '/public');
var clientO = new OpenSecretsClient('8fad4c535bd7763204689b57c70137fd'); //the json values are returned as a string

var opKeys = ['8fad4c535bd7763204689b57c70137fd', 'd54dbd5a4f572862c2609aab9487a365', 'f8cea77db428d13c088ac8afff35e519', 'be091217e1dd3b340e2511e38699efa7', 'db37558aa3f970cadfb8345c26d1dde6','5928e99d96fac2a30906a126a293714d', '1ad00b500ae4d8a0a3333c7e1689eebb', 'c29969ede23d4f4871205c97548a8290', '2d87571b3707af874843d8e9f3391666']

app.use(express.static('public'))
app.listen(9000, () => console.log('Example app listening on port 3000!'))

app.get('/about', function(req, res) {
    res.setHeader('Content-Type', 'text/html')
    res.sendFile(__dirname+'/public/about.html')
})

app.get('/search/:query', function(req, res) {
    request({ url: 'https://api.propublica.org/congress/v1/bills/search.json?query='+req.params.query+'&sort=_score', headers: { 'X-API-Key': 'CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF' } }, function (err, lRes, body) {
        res.setHeader('Content-Type', 'text/html')    
        val = JSON.parse(body)
        submit = { bills: [] }
        goodStuff = val.results[0].bills
        for (i = 0; i < goodStuff.length; i++) {
            submit.bills.push({ slug: goodStuff[i].bill_slug, link: '../billinfo/' + goodStuff[i].bill_slug, name: ((goodStuff[i].short_title == null) ? goodStuff[i].title: goodStuff[i].short_title), summary: ((goodStuff[i].summary_short == "") ? 'Not provided' : goodStuff[i].summary_short), lastDate: goodStuff[i].latest_major_action_date, housePass: ((goodStuff[i].house_passage == null) ? 'not passed' : goodStuff[i].house_passage), senatePass: ((goodStuff[i].senate_passage == null) ? 'not passed' : goodStuff[i].senate_passage) })
        }
        res.render('index.mustache', submit)
    })
})

app.get('/home', function(req, res) {
    res.setHeader('Content-Type', 'text/html')
    request({ url: 'https://api.propublica.org/congress/v1/both/votes/recent.json', headers: { 'X-API-Key': 'CfNPRL9q6wPC8iEHEG4PhZk9xiQbcWSTvVFjqItF'}}, function (err, lRes, body) {
        res.setHeader('Content-Type', 'text/html')   
        submit = { singleVote: true, bills: [] }
        body = JSON.parse(body)
        goodStuff = body.results.votes
        for (i = 0; i < goodStuff.length; i++) {
            var str = goodStuff[i].bill.bill_id
            var arr = str.split("-")
            submit.bills.push({pass:((goodStuff[i].result.includes('Pass') || goodStuff[i].result.includes('Agreed'))? true:false),result: goodStuff[i].result, slug:goodStuff[i].chamber+' | '+ arr[0], link: '../billinfo/' + arr[0], name: goodStuff[i].bill.title, summary: ((goodStuff[i].description=='')? 'None provided':goodStuff[i].description), lastDate: ((null==goodStuff[i].bill.latest_action)? 'None provided':goodStuff[i].bill.latest_action)})
        }
        res.render('index.mustache', submit)
    })
})

app.get('/home/:chamber', function (req, res) {
    res.redirect('/home')
})

app.get('/billinfo/:billId', function (req, res) {
    res.setHeader('Content-Type', 'text/html')
    p = ppc.getBill(req.params.billId).then(function (val) {
        if(typeof val.results === 'undefined') {
            res.sendFile(__dirname+'/public/error.html')
            return
        }
        
        val = val.results[0]
        submit = {actionShow: val.senate_passage || val.house_passage, name: val.short_title, votePresent: ((val.votes.length > 0)? true: false), actionPresent: ((val.actions.length > 0)? true: false),summary: val.summary, lastDate: val.latest_major_action_date, senatePass: ((val.senate_passage==null)? 'not passed':val.senate_passage), housePass: ((val.house_passage==null)? 'not passed': val.house_passage), actions:[], vote:[]}
        for(var i = 0; i < val.actions.length; i++) {
            submit.actions.push({ date: val.actions[i].datetime, chamber: val.actions[i].chamber, type: val.actions[i].action_type, description: val.actions[i].description})
        }
        for (var i = 0; i < val.votes.length; i++) {
            submit.vote.push({pass: ((val.votes[i].result == 'Passed' | val.votes[i].result.includes('Agreed'))? true: false), date: val.votes[i].date, chamber: val.votes[i].chamber, question: val.votes[i].question, result: val.votes[i].result, link: '../../graphs/' + val.congress + '/' + val.bill_slug + '/' + i})
        }
        res.render('billinfo.mustache', submit)
    })
    p.catch(function(val) {
        res.sendFile(__dirname+'/public/error.html')
    })
})

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

app.get('/graphs/:congress/:bill/:vote', function (req, res) {
    console.log('starting')
    res.setHeader('Content-Type', 'text/html')
    ppc.getBill(req.params.bill, req.params.congress).then(function (value) {
        var str = ''+value.results[0].votes[req.params.vote].api_url;
        console.log(str)
        var arr = str.split("/");
        var nodes = [];
        var edges = []
        var members = {}
        ppc.getRollCallVotes(arr[6], arr[8], arr[10].replace('.json', ''), arr[5]).then(function(resp){
            //sort nodes by parties
            var sortedResp = resp.results.votes.vote.positions.sort(function(a, b) {
                return a.party.charCodeAt(0)-b.party.charCodeAt(0);
            })       
            //puts all of the members of congress in the circular formation and sets up the basic node
            var party = {}
            for(var i = 0; i < sortedResp.length; i++) {
                var info = sortedResp[i]
                var cVal = [0, 0, 0]
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
                
                change = Math.round(Math.abs(100*info.dw_nominate))
                if(info.dw_nominate > 0) {
                    cVal[0] = 255
                    cVal[1] = 204-change
                    cVal[2] = 204-change
                } else {
                    cVal[0] = Math.round(204-change*1.31)
                    cVal[1] = 217-change
                    cVal[2] = 255
                } 

                var angle = 2*i*Math.PI/sortedResp.length

                x = Math.cos(angle)
                y = Math.sin(angle)

                party[info.party].x += x
                party[info.party].y += y

                members[info.member_id] = {name: info.name, color: cVal, vote: info.vote_position, party: info.party, voteShown: false }
                //coloring needs to reflect vote not party
                nodes.push({id: info.member_id, label: info.name+' ('+info.party+')', color: rgbToHex(cVal[0],cVal[1],cVal[2]), size: 1, x: x, y: y})
            }
            request(resp.results.votes.vote.source, function (err, res, body) {
                parseString(body, function (err, result) {
                    if (typeof result['rollcall-vote'] != 'undefined') {
                        var info = result['rollcall-vote']['vote-data'][0]['recorded-vote']
                        for (i = 0; i < info.length; i++) {
                            current = info[i].legislator[0]['$']

                            vote = info[i]['vote'][0]
                            if (vote == 'Yea') {
                                vote = 'Yes'
                            } else if (vote == 'Nay') {
                                vote = 'No'
                            }
                            a = { party: current['party'], id: current['name-id'], vote: vote }
                            if (members[a.id].vote != a.vote) {
                                console.log('bad data')
                                console.log('recieved bad data a', a, members[a.id])
                            }
                        }
                    } else {
                        var info = result.roll_call_vote.members[0].member
                        for (i = 0; i < info.length; i++) {
                            current = info[i]

                            vote = current.vote_cast[0]
                            if (vote == 'Yea') {
                                vote = 'Yes'
                            } else if (vote == 'Nay') {
                                vote = 'No'
                            }

                            a = { party: current.party[0], name: current.first_name + ' ' + current.last_name, vote: vote }

                            works = false
                            for (i = 0; i < Object.keys(members).length; i++) {
                                if (a.name == members[Object.keys(members)[i]].name && a.vote == members[Object.keys(members)[i]].vote) {
                                    works = true
                                } else if (a.name == members[Object.keys(members)[i]].name) {
                                    console.log(members[Object.keys(members)[i]])
                                }
                            }

                            if (!works) {
                                console.log('recieved bad data b', a, members[Object.keys(members)[i]])
                            }
                        }
                    }
                });
            });
            //make the special interest nodes (parties, donors)
            var topIndustry = {}
            for (var i = 0; i < nodes.length; i++) {
                var obj = JSON.parse(fs.readFileSync('./app/persistentdata/' + nodes[i].id + '.' + req.params.congress +'.json', 'utf8'));
                
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

            nodes.push({ id: 'main', label: req.params.bill, color: '#fff', x: 0, y: 0, size: 5, color: ((!(resp.results.votes.vote.result == 'Passed' | resp.results.votes.vote.result.includes('Agreed')))? '#f00': '#0f0')})

            //add party nodes
            for(var i = 0; i < Object.keys(party).length; i++) {
                var current = party[Object.keys(party)[i]] 
                var total = current.yes + current.no + current.none

                if(current.yes/total > .5) {
                    party[Object.keys(party)[i]].vote = 'Yes'
                } else if (current.no / total > .5) {
                    party[Object.keys(party)[i]].vote = 'No'
                } else if (current.none / total > .5) {
                    party[Object.keys(party)[i]].vote = 'Not Voting'
                } else {
                    delete party[Object.keys(party)[i]]
                    i--
                    continue
                }

                cVal = '#ffff00'
                if (Object.keys(party)[i] == 'R') {
                    cVal = '#e60000'
                } else if (Object.keys(party)[i] == 'D') {
                    cVal = '#0000e6'
                }
                nodes.push({ id: Object.keys(party)[i], label: Object.keys(party)[i], color: cVal, size: 3+2*(total/Object.keys(members).length), x: current.x / total, y: current.y / total }) //todo should change size
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

                    cVal = [0,0,0]
                    for(a = 0; a < cIndustry.memberid.length; a++) {
                        cVal[0] += members[cIndustry.memberid[a]].color[0]
                        cVal[1] += members[cIndustry.memberid[a]].color[1]
                        cVal[2] += members[cIndustry.memberid[a]].color[2]
                    }
                    //this would be used to keep nodes from the premimeter
                    //var angle = Math.atan(y/x)
                    /*if(Math.sqrt(Math.pow(Math.cos(angle)-x, 2)+Math.pow(Math.sin(angle)-y, 2)) < .1) {
                    console.log(Object.keys(topIndustry)[i], x, y, -Math.cos(angle) * .1 * (Math.abs(x) / x), -Math.sin(angle) * .1 * (Math.abs(y) / y))
                        x += -Math.cos(angle)*.1*(Math.abs(x)/x)
                       y += -Math.sin(angle) * .1 * (Math.abs(y) / y)
                        console.log(x,y)
                   } */
                    nodes.push({ id: Object.keys(topIndustry)[i], label: Object.keys(topIndustry)[i], color: rgbToHex(Math.round(cVal[0]/total), Math.round(cVal[1]/total),Math.round(cVal[2]/total)), size: 2+40*(total/Object.keys(members).length), x: x, y: y}) //todo should change size
                }
            }

            //members to industry
            for (var i = 0; i < Object.keys(topIndustry).length; i++) {
                currentIndustry = topIndustry[Object.keys(topIndustry)[i]].memberid
                for(var a = 0; a < currentIndustry.length; a++) {  
                    if (members[currentIndustry[a]].vote == topIndustry[Object.keys(topIndustry)[i]].vote) {    
                        members[currentIndustry[a]].voteShown = true
                        
                        cVal = '#ffff80'
                        if (members[currentIndustry[a]].party == 'D') {
                            cVal = '#99b3ff'
                        } else if (members[currentIndustry[a]].party == 'R') {
                            cVal = '#ff8080'
                        }
                        edges.push({ id: 'e' + currentIndustry[a] + '.' + Object.keys(topIndustry)[i], source: currentIndustry[a], target: Object.keys(topIndustry)[i], color: cVal})
                    }
                }
            }

            //industry to center
            for (var i = 0; i < Object.keys(topIndustry).length; i++) {
                var cVal = '#ff0000'
                if (topIndustry[Object.keys(topIndustry)[i]].vote == 'Yes') {
                    cVal = '#00ff00'
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
                var cVal = '#ff0000'
                if (party[Object.keys(party)[i]].vote == 'Yes') {
                    cVal = '#00ff00'
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
                    var cVal = '#ff0000'
                    if (current.vote == 'Yes') {
                        cVal = '#00ff00'
                    } else if (current.vote == 'None') {
                        continue
                    }

                    edges.push({ id: 'e' + Object.keys(members)[i] + '.main', target: 'main', source: Object.keys(members)[i], color: cVal })
                }
            }
        }).then(function(value) {
            solution = { "nodes": nodes, "edges": edges }
            console.log('returning graph')
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
    var localClient = new OpenSecretsClient(opKeys[pos%9]);
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
        console.log('finished process')
    })
}

function verifiedJSON(val) {
    var a;
    try {
        a = JSON.parse(val);
    } catch (e) {
        console.log('caught ' + a); // error in the above string (in this case, yes)!
        a = {bad:true}
    } finally {
        return a
    }
}

app.get('/testing', function (req, res) {
    res.setHeader('Content-Type', 'application/json');

    var first = ppc.getCurrentSenators('NY')

    extRes = res
    //https://www.senate.gov/legislative/LIS/roll_call_votes/vote1151/vote_115_1_00017.xml
    //http://clerk.house.gov/evs/2017/roll438.xml
    request('https://www.senate.gov/legislative/LIS/roll_call_votes/vote1151/vote_115_1_00017.xml', function (err, res, body) {
        parseString(body, function (err, result) {
            console.log(result);
            //extRes.send(result)

            ans = {}

            if(!typeof result['rollcall-vote'] === 'undefined') {
                var info = result['rollcall-vote']['vote-data'][0]['recorded-vote']
                for(i = 0; i < info.length; i++) {
                    current = info[i].legislator[0]['$']

                    vote = info[i]['vote'][0]
                    if(vote == 'Yea') {
                        vote = 'Yes'
                    } else if (vote == 'Nae') {
                        vote = 'No'
                    }
                    ans[current['name-id']] = {party: current['party'], id: current['name-id'], vote: vote}
                }
                console.log('ans ', ans)
            } else {
                var info = result.roll_call_vote.members[0].member
                for (i = 0; i < info.length; i++) {
                    current = info[i]

                    vote = current.vote_cast[0]
                    if (vote == 'Yea') {
                        vote = 'Yes'
                    } else if (vote == 'Nay') {
                        vote = 'No'
                    }
                    ans[current.first_name[0] + ' ' + current.last_name[0]] = { party: current.party[0], id: current.first_name + ' ' + current.last_name, vote: vote }
                }
            }
            extRes.send(ans)
        });
    });

    var second = new Promise((resolve, reject) => {
        clientO.makeRequest('candIndustry', { cid: 'N00000286', cycle:2014, output: 'json' })
            .on('complete', function (res) {
                if (res instanceof Error) console.log('Something went wrong');
                val = verifiedJSON(res)

                resolve(val)
            })
    });
    Promise.all([first, second]).then(function (value, boo = res) {
        if(value[1].bad) {
            //boo.send(value[0])
        } else {
            var ans = mergeJSON.merge(JSON.parse(JSON.stringify(value[0])), JSON.parse(JSON.stringify((value[1]))))
            
            //boo.send(ans)
        }
    })
})