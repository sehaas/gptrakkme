import './style.css';
import '../node_modules/leaflet/dist/leaflet.css';
import '../node_modules/leaflet-fullscreen/dist/leaflet.fullscreen.css';
import './sprite.css';

var L = require('leaflet');
require('leaflet-easybutton');
require('leaflet-fullscreen');
var gpx2geojson = require('@mapbox/togeojson').gpx;
var d3 = require('d3');
var d3axis = require('d3-axis');

var coordist = require('coordist');
var navigo = require('navigo');
var DeviationStream = require('standard-deviation-stream');

const gptrakkme = window.gptrakkme = {};

d3.formatDefaultLocale({
	"decimal": ",",
	"thousands": ".",
	"grouping": [3],
	"currency": ["", "\u00a0€"]
});

var formatHeight = d3.format(",");
var formatSpeed = d3.format('.2f');
var formatDistance = d3.format('.4s');

// create map
var map = gptrakkme.map = L.map(d3.select(document.body)
	.append('div')
	.attr('id', 'map')
	.node(), {
		dragging: !L.Browser.mobile,
		fullscreenControl: {
			pseudoFullscreen: true
		}
	}).setView([48, 14], 13);

var BasemapAT_grau = L.tileLayer('https://maps{s}.wien.gv.at/basemap/bmapgrau/normal/google3857/{z}/{y}/{x}.{format}', {
	maxZoom: 19,
	attribution: 'Datenquelle: <a href="www.basemap.at">basemap.at</a>',
	subdomains: ["", "1", "2", "3", "4"],
	format: 'png',
	bounds: [[46.35877, 8.782379], [49.037872, 17.189532]]
});
BasemapAT_grau.addTo(map);
var OpenStreetMap_Mapnik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

L.control.layers({
	"Basemap" : BasemapAT_grau,
	"Mapnik" : OpenStreetMap_Mapnik
}).addTo(map);

L.control.scale().addTo(map);
var allLayers = L.featureGroup([]);
L.easyButton( 'gpt-sphere', function(){
	map.fitBounds(allLayers.getBounds());
}).addTo(map);
var hereMarker = L.circleMarker(L.latLng(0, 0), {
	color: 'darkred', weight: 1, opacity: 1,
	fillColor: 'red', fillOpacity: 1, radius: 5
}).addTo(map);

gptrakkme.colors = {
	'single': '#FF0000',
	'0': '#FF0000',
	'1': '#800080',
	'2': '#008000',
	'3': '#808000',
	'4': '#008080'
};

gptrakkme.loadTracks = function(error, data) {
	d3.select('title').text('gptrakkme | ' + data.name);
	var q = d3.queue();
	data.tracks.forEach(function(track) {
		console.log(track);
		q = q.defer(d3.text, track);
	});
	q.awaitAll(function(error, results) {
		if (error) throw error;
		results.forEach(gptrakkme.renderLayer);
	});
};

gptrakkme.renderLayer = function(str, trackIndex) {
	var dom = (new DOMParser()).parseFromString(str, 'text/xml');
	var geojson = gpx2geojson(dom);

	var props = geojson.features[0].properties,
		coords = geojson.features[0].geometry.coordinates;

	var dist = 0.0,
		hM_a = 0.0,
		hM_d = 0.0,
		last = {lng:coords[0][0], lat:coords[0][1], alt:coords[0][2]};

	props.distance = [0.0];
	props.speed = [0.0];
	var speedDeviation = new DeviationStream();
	for(var i = 1; i < coords.length; i++) {
		var curr = {lng:coords[i][0], lat:coords[i][1], alt:coords[i][2]};
		var hm = curr.alt - last.alt;
		if (hm > 0) {
			hM_a += hm;
		} else {
			hM_d += hm;
		}
		var d = coordist.distance(last, curr, false);
		var dt = new Date(props.coordTimes[i]) - new Date(props.coordTimes[i-1]);
		var tmp_speed = dt != 0 ? 3600 * d / dt : null;
		speedDeviation.push(tmp_speed);
		props.speed[i] = tmp_speed;
		props.distance[i] = d;
		dist += d;
		last = curr;
	}
	props.speed.forEach(function(v, i) {
		if ((v - speedDeviation.mean()) > (speedDeviation.standardDeviation() * 5)) {
			props.speed[i] = null;
		}
	});
	var detail = [];
	detail.push({
		class: 'gpt-location',
		data: [
			[formatDistance(parseInt(dist)) + "m"],
			[formatHeight(parseInt(coords.length)) + " trkpt"]
		]
	});

	var datePlaceHeart = props.coordTimes.map(function(d, i) {
			var hr = null; // support tracks without HR data
			if (props.heartRates) {
				hr=props.heartRates[i];
			}
			return [new Date(d), coords[i], hr, props.speed[i]];
		}),
		bisectPlace = d3.bisector(function(d) { return d[0]; }).left,
		height = 100,
		margin = 20,
		width = d3.select('body').node().offsetWidth - 2 * margin - 10;

	var duration = datePlaceHeart[datePlaceHeart.length-1][0] - datePlaceHeart[0][0];
	detail.push({
		class: 'gpt-stopwatch',
		data : [
			[d3.utcFormat("%Hh:%Mm:%Ss")(duration)]
		]
	});

	var maxHeight = d3.max(datePlaceHeart, function(d) { return d[1][2]; });
	var minHeight = d3.min(datePlaceHeart, function(d) { return d[1][2]; });
	var elevation = d3.scaleLinear()
		.range([height, 0])
		.domain([0, maxHeight]);

	detail.push({
		class: 'gpt-area-graph',
		data: [
			[formatHeight(parseInt(Math.abs(hM_a))) + 'm', 'gpt-ascent'],
			[formatHeight(parseInt(Math.abs(hM_d))) + 'm', 'gpt-descent'],
			[formatHeight(parseInt(maxHeight)) + 'm', 'gpt-max'],
			[formatHeight(parseInt(minHeight)) + 'm', 'gpt-min']
		]
	});

	// render map layers
	var casingLayer = L.geoJson(geojson, {
		style: function() { return { weight: 6, color: '#fff', opacity: 1 }; }
	}).addTo(map);
	var runLayer = L.geoJson(geojson, {
		style: function() { return { weight: 4, color: gptrakkme.colors[trackIndex], opacity: 0.5 }; }
	}).addTo(map);
	// add
	allLayers.addLayer(runLayer);
	map.fitBounds(allLayers.getBounds());
	hereMarker.bringToFront();

	var x = d3.scaleTime()
		.domain([datePlaceHeart[0][0], datePlaceHeart[datePlaceHeart.length-1][0]])
		.rangeRound([0, width]);

	var maxSpeed = d3.max(datePlaceHeart, function(d) { return d[3]; });
	// meter / (milliseconds / 3600) => km/h
	var avgSpeed = dist / (duration / 3600) ;
	var minSpeed = d3.min(datePlaceHeart, function(d) { return d[3]; });
	var speed = d3.scaleLinear()
		.range([height, 0])
		.domain([minSpeed, maxSpeed]);
	detail.push({
		class: 'gpt-gauge',
		data: [
			[formatSpeed(avgSpeed) + ' km/h', 'gpt-avg'],
			[formatSpeed(maxSpeed) + ' km/h', 'gpt-max']
		]
	});

	var maxHeart = d3.max(datePlaceHeart, function(d) { return d[2]; });
	var avgHeart = d3.mean(datePlaceHeart, function(d) { return d[2]; });
	var minHeart = d3.min(datePlaceHeart, function(d) { return d[2]; });
	var heart = d3.scaleLinear()
		.range([height, 0])
		.domain([minHeart, maxHeart]);

	var optionalHeartData = [];
	if (!!avgHeart) optionalHeartData.push([parseInt(avgHeart) + ' bpm', 'gpt-avg']);
	if (!!maxHeart) optionalHeartData.push([parseInt(maxHeart) + ' bpm', 'gpt-max']);
	if (!!minHeart) optionalHeartData.push([parseInt(minHeart) + ' bpm', 'gpt-min']);

	if (optionalHeartData.length > 0) {
		detail.push({
			class: 'gpt-heartbeat',
			data: optionalHeartData
		});
	}

	var elevationLine = d3.area()
		.x(function(d) { return x(d[0]); })
		.y0(height)
		.y1(function(d) { return elevation(d[1][2]); });

	var speedLine = d3.line()
		.curve(d3.curveBasis)
		.defined(function(d) {
			var show = d[3]!=null;
			if (!show) console.log('Skip speed:', d[0]);
			return show;
		})
		.x(function(d) { return x(d[0]); })
		.y(function(d) { return speed(d[3]); });

	var heartLine = null;
	if (optionalHeartData.length > 0) {
		heartLine = d3.line()
			.curve(d3.curveBasis)
			.defined(function(d) {
				var show = d[2]!=null;
				if (!show) console.log('Skip HR:', d[0]);
				return show;
			})
			.x(function(d) { return x(d[0]); })
			.y(function(d) { return heart(d[2]); });
	} else {
		console.log('No HR available');
	}

	var trackDiv = d3.select(document.body).append('div').attr('class', 'track-nr track-nr-' + trackIndex);
	var svg = trackDiv.append('svg')
		.attr('width', width + 2 * margin)
		.attr('height', height + 2 * margin);
	var g = svg.append('g')
		.attr('class', 'chart')
		.attr('transform', 'translate(' + margin + ',' + margin + ')');
	g.append('path')
		.datum(datePlaceHeart)
		.attr('class', 'elevation-area')
		.attr('d', elevationLine);
	g.append('path')
		.datum(datePlaceHeart)
		.attr('class', 'heart-line')
		.attr('d', heartLine);
	g.append('path')
		.datum(datePlaceHeart)
		.attr('class', 'speed-line')
		.attr('d', speedLine);

	var xDuration = d3.scaleTime()
		.domain([0, datePlaceHeart[datePlaceHeart.length-1][0] - datePlaceHeart[0][0]])
		.rangeRound([0, width]);
	var xAxis = d3axis.axisBottom(xDuration);
	xAxis.tickFormat(d3.utcFormat("%-Hh%M"));
	g.append('g').attr('transform', 'translate(0,' + height + ')').call(xAxis);

	var marker = g.append('rect')
		.attr('width', 1)
		.attr('class', 'here-indicator')
		.attr('height', height);

	var statusDiv = trackDiv.append('div').attr('class', 'status-box');
	var markerDiv = statusDiv.append('div').attr('class', 'marker-box').attr('style', 'display:none;');
	var heightText = markerDiv.append('div').attr('class', 'marker-value');
	var heartText = markerDiv.append('div').attr('class', 'marker-value');
	var speedText = markerDiv.append('div').attr('class', 'marker-value');

	var totalDiv = statusDiv.selectAll('.track-info').data(detail);
	totalDiv.enter().append('div')
		.attr('class', function(d) { return 'track-info icon-2x ' + d.class; })
		.selectAll('div').data(function(d) { return d.data; })
		.enter().append('div')
			.attr('class', function(d) { return (d[1] || '') })
			.html(function(d) {return d[0]; });

	var moveMarker = function(evt){
		var posX = d3.mouse(this)[0];
		d3.selectAll('.here-indicator').attr('transform', 'translate(0,0)');
		marker.attr('transform', 'translate(' + [posX, 0] + ')');
		var datum = datePlaceHeart[bisectPlace(datePlaceHeart, x.invert(posX))];
		hereMarker.setLatLng(L.latLng(datum[1][1], datum[1][0]));
		heightText.text(d3.format("0.2f")(datum[1][2]) + "m");
		heartText.text(datum[2] + "bpm");
		speedText.text(d3.format("0.2f")(datum[3]) + "km/h");
	};

	svg.append("rect")
		.attr("fill", "transparent")
		.attr('width', width)
		.attr('height', height)
		.attr('transform', 'translate(' + margin + ',' + margin + ')')
		.on("mousemove", moveMarker);
};

var root = window.location.origin;
var useHash = false; // Defaults to: false
var hash = '#!'; // Defaults to: '#'
var router = new navigo(root, useHash, hash);

router.on({
	'/:trk': function(params) {
		console.log(params);
		d3.json('/data/' + params.trk, gptrakkme.loadTracks);
	},
	'/r/:trk': function(params) {
		console.log(params);
		d3.text('/data/' + params.trk + '.gpx', function(data) {
			gptrakkme.renderLayer(data, 'single');
		});
	},
	'*': function() {
		console.log('default', arguments);
	}
}).resolve();
