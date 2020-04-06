const express = require('express')
var cors = require('cors');
const port = 5000;
const config = require('./config.json');
var bodyParser = require("body-parser");
const loadtest = require('loadtest');
//var Memcached = require('memcached');
let exp = config.N * 60;
//var memcached = new Memcached(config.ipaddr, {maxExpiration:exp,retries:10,retry:10000,remove:true});
var cache = require('memory-cache');

let trackingIds = ["INF-yj562hjojzbtez","INF-3gbfcjjsd6vhvo","INF-ixpktk3itsk86","INF-1bi5qk0zocqcz"];
let eventTypes = ['user-event','signup','review'];

var memCopy = {
	'signup':{totalEventsCaptured:0,eventsCapturedByTrackingIds:{}},
	'review':{totalEventsCaptured:0,eventsCapturedByTrackingIds:{}},
	'user-event':{totalEventsCaptured:0,eventsCapturedByTrackingIds:{}}
};

var samples = {"signup":`{"path":"/visitors/events/","value":{"fingerprint":"5d4697775392fc850a737fe225fbd8e9","sessionId":"0da4fc08-3f12-5890-fdce-2455fc17c394","visitorId":"be4ab37a-1de9-a0f0-f973-562b7cd4365e","trackingId":"INF-yj562hjojzbtez","userId":null,"userProfile":null,"geo":{"latitude":28.58,"longitude":77.33,"city":"Noida","country":"India","ip":"103.83.128.66"},"form":{"formId":"2bc04127-92d8-eb72-b1d3-26dc63f6ff19","email":"agency@gmail.com","anonymous":"Login"},"timestamp":"2019-12-08T06:42:57.289Z","event":"formsubmit","source":{"url":{"host":"app.useinfluence.co","hostname":"app.useinfluence.co","pathname":"/login","protocol":"https:"}},"referrer":""}}`,
	"review":`{"path":"/visitors/events/","value":{"fingerprint":"5d4697775392fc850a737fe225fbd8e9","sessionId":"0da4fc08-3f12-5890-fdce-2455fc17c394","visitorId":"be4ab37a-1de9-a0f0-f973-562b7cd4365e","trackingId":"INF-yj562hjojzbtez","userId":null,"userProfile":null,"geo":{"latitude":28.58,"longitude":77.33,"city":"Noida","country":"India","ip":"103.83.128.66"},"form":{"formId":"2bc04127-92d8-eb72-b1d3-26dc63f6ff19","email":"agency@gmail.com","anonymous":"Login"},"timestamp":"2019-12-08T06:42:57.289Z","event":"review","source":{"url":{"host":"app.useinfluence.co","hostname":"app.useinfluence.co","pathname":"/login","protocol":"https:"}},"referrer":""}}`,
	"user-event":`{"path":"/visitors/events/","value":{"fingerprint":"5d4697775392fc850a737fe225fbd8e9","sessionId":"25ad9867-e9a5-cedf-0fc4-0c30b1c2a505","visitorId":"1bfdd0e4-2629-6ef9-21ea-9f1b1f11fe02","trackingId":"INF-yj562hjojzbtez","userId":null,"userProfile":null,"geo":{"latitude":28.58,"longitude":77.33,"city":"Noida","country":"India","ip":"103.83.128.17"},"target":{"id":"FPqR3acHqJeA3acH7MM9_0","selector":"div#FPqR2DbIqJeA2DbI7MM9_0.animated_FPqR2bI7Mf_c.slideInDown:nth-child(23)>div#FPqR3tRBqJeA3tRB7MM9_0:nth-child(1)>div:nth-child(1)>div:nth-child(1)>div:nth-child(2)>div#FPqR3dGiqJeA3dGi7MM9_0:nth-child(1)>div.FPqR2B_4qJeA2B_47MM9_0.rounded.FPqRD2zVqJeAD2zV7MM9_0:nth-child(1)>div#FPqR3acHqJeA3acH7MM9_0:nth-child(1)"},"timestamp":"2019-12-08T07:10:30.485Z","event":"click","source":{"url":{"host":"useinfluence.co","hostname":"useinfluence.co","pathname":"/","protocol":"https:"}},"referrer":""}}`
};
var memArr = [];

const options = {
	url: `http://localhost:${port}/`,
	concurrency: 5,
	method: 'POST',
	body: '',
	requestsPerSecond:config.rate, // From the config file
	maxSeconds:10,
	requestGenerator: (params, options, client, callback) => {
		// Generate random event type
		let ev = eventTypes[Math.floor(Math.random() * eventTypes.length)];
		// Generate random tracking Id
		let tid = trackingIds[Math.floor(Math.random() * trackingIds.length)];
		// Sample JSON parse and set tracking id
		let sample = samples[ev];
		sample = JSON.parse(sample);
		sample.value.trackingId = tid; 
		let message = sample;
		message = JSON.stringify(message);
		options.headers['Content-Length'] = message.length;
		options.headers['Content-Type'] = 'application/json';
		// Pass the event type as url param
		options.path = '/eventTest/'+ev;
		const request = client(options, callback);
		request.write(message);
		return request;
	}
};

function runTest(){
	loadtest.loadTest(options, (error, results) => {
		if (error) {
			return console.error('Got an error: %s', error);
		}
		console.log(results);
		console.log(memCopy);
	});
}
// Run the test on starting the node app
runTest();

const app = express()
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})

app.post('/eventTest/:etype',function(req,res){
	try{
		//Extract event type and tracking id  from the request
		let etype = req.params.etype;
		let body = req.body;
		let tid = body.value.trackingId;
		memCopy[etype].totalEventsCaptured++;
		if(memCopy[etype].eventsCapturedByTrackingIds[tid]){
			memCopy[etype].eventsCapturedByTrackingIds[tid]++;
		}else{
			memCopy[etype].eventsCapturedByTrackingIds[tid] = 1;
		}
		let currTime = Math.floor(Date.now() / 1000);
		let len = memArr.length;
		for (var i = 0; i < len; i++) {
			let val = memArr[i];
			if(typeof val == "undefined")
				continue;
			if( currTime - val.time  >= exp){
				memCopy[val.etype].totalEventsCaptured--;
				memCopy[val.etype].eventsCapturedByTrackingIds[val.tid]--;
				memArr.splice(i, 1);
				console.log('removed',val.etype,val.tid);
			}
		}
		memArr.push({etype:etype,tid:tid,time:currTime});
		// Store in memcached
		// memcached.set(etype, memCopy[etype], exp, function (err) { 
		// 	console.log('Memcached error: '+err);
		// });	
		cache.put(etype, JSON.stringify(memCopy[etype]));
		res.send({message:'success'})
	}catch(err){
        console.log('An Error Occurred. -> :',err);
        res.send({message :err}); 
    }
})
app.get('/showCacheContents',function(req,res){
	try{
		// memcached.get('user-event', function (err, data) {
		//   	if(err){
		//   		console.log(err);
		// 		console.log('Memcached error: '+err);
		//   	}else{
		// 	  	console.log(data);
		// 		res.send({data:data})
		//   	}
		// });
		let obj = {};
		eventTypes.forEach(function(val,key){
			obj[val] = cache.get(val)
		})
		console.log(obj);
		res.send(obj); 
	}catch(err){
        console.log('An Error Occurred. -> :',err);
        res.send({message :err}); 
    }
})
app.get('/runTest',function(req,res){
	try{
		runTest();
		res.send({message:'Running Test: Check Console'}); 
	}catch(err){
        console.log('An Error Occurred. -> :',err);
        res.send({message :err}); 
    }
})
