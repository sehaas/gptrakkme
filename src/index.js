import './style.css';
import '../node_modules/leaflet/dist/leaflet.css';
import '../node_modules/leaflet-fullscreen/dist/leaflet.fullscreen.css';
import './sprite.css';

var L = require('leaflet');
require('leaflet-easybutton');
require('leaflet-fullscreen');
var gpx2geojson = require('@mapbox/togeojson').gpx;
var d3 = require('d3');

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
L.control.scale().addTo(map);
var allLayers = L.featureGroup([]);
L.easyButton( 'gpt-sphere', function(){
	map.fitBounds(allLayers.getBounds());
}).addTo(map);
var hereMarker = L.circleMarker(L.latLng(0, 0), {
	color: 'darkred', weight: 1, opacity: 1,
	fillColor: 'red', fillOpacity: 1, radius: 5
}).addTo(map);

gptrakkme.loadTracks = function(error, data) {
	data.tracks.forEach(function(track) {
		d3.select('title').text('gptrakkme | ' + data.name);
		d3.text(track, gptrakkme.renderLayer);
	});
};

gptrakkme.renderLayer = function(str) {

	var dom = (new DOMParser()).parseFromString(str, 'text/xml');
	var geojson = gpx2geojson(dom);

	var props = geojson.features[0].properties,
		coords = geojson.features[0].geometry.coordinates;

	var dist = 0.0,
		hM_a = 0.0,
		hM_d = 0.0,
		meter = d3.format(">7,d"),
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
		var tmp_speed = 3600 * d / dt;
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
	detail.push([
		'gpt-location',
		[d3.format('.4s')(parseInt(dist)) + "m"],
		[]
	]);

	var datePlaceHeart = props.coordTimes.map(function(d, i) {
			var hr = 0; // support tracks without HR data
			if (props.heartRates) {
				hr=props.heartRates[i];
			}
			return [new Date(d), coords[i], hr, props.speed[i]];
		}),
		bisectPlace = d3.bisector(function(d) { return d[0]; }).left,
		height = 100,
		margin = 20,
		width = d3.select('body').node().offsetWidth - 2 * margin;

	detail.push([
		'gpt-stopwatch',
		[d3.utcFormat("%Hh:%Mm:%Ss")(datePlaceHeart[datePlaceHeart.length-1][0] - datePlaceHeart[0][0])],
		[] // TODO: Pause??
	]);
	detail.push([
		'gpt-area-graph',
		[d3.format(',')(parseInt(Math.abs(hM_a))) + 'm', 'gpt-ascent'],
		[d3.format(',')(parseInt(Math.abs(hM_d))) + 'm', 'gpt-descent']
	]);

	// render map layers
	var casingLayer = L.geoJson(geojson, {
		style: function() { return { weight: 6, color: '#fff', opacity: 1 }; }
	}).addTo(map);
	var runLayer = L.geoJson(geojson, {
		style: function() { return { weight: 4, color: '#ff0000', opacity: 0.5 }; }
	}).addTo(map);
	// add
	allLayers.addLayer(runLayer);
	map.fitBounds(allLayers.getBounds());
	hereMarker.bringToFront();

	var x = d3.scaleTime()
		.domain([datePlaceHeart[0][0], datePlaceHeart[datePlaceHeart.length-1][0]])
		.rangeRound([0, width]);

	var maxHeight = d3.max(datePlaceHeart, function(d) { return d[1][2]; });
	var minHeight = d3.min(datePlaceHeart, function(d) { return d[1][2]; });
	var elevation = d3.scaleLinear()
		.range([height, 0])
		.domain([0, maxHeight]);

	var maxSpeed = d3.max(datePlaceHeart, function(d) { return d[3]; });
	var avgSpeed = d3.mean(datePlaceHeart, function(d) { return d[3]; });
	var minSpeed = d3.min(datePlaceHeart, function(d) { return d[3]; });
	var speed = d3.scaleLinear()
		.range([height, 0])
		.domain([minSpeed, maxSpeed]);
	detail.push([
		'gpt-gauge',
		[d3.format('.2f')(avgSpeed) + ' km/h', 'gpt-avg'],
		[d3.format('.2f')(maxSpeed) + ' km/h']
	]);

	var maxHeart = d3.max(datePlaceHeart, function(d) { return d[2]; });
	var avgHeart = d3.mean(datePlaceHeart, function(d) { return d[2]; });
	var minHeart = d3.min(datePlaceHeart, function(d) { return d[2]; });
	var heart = d3.scaleLinear()
		.range([height, 0])
		.domain([minHeart, maxHeart]);
	detail.push([
		'gpt-heartbeat',
		[parseInt(avgHeart) + ' bpm', 'gpt-avg'],
		[parseInt(maxHeart) + ' bpm']
	]);

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

	var heartLine = d3.line()
		.curve(d3.curveBasis)
		.defined(function(d) {
			var show = d[2]!=null;
			if (!show) console.log('Skip HR:', d[0]);
			return show;
		})
		.x(function(d) { return x(d[0]); })
		.y(function(d) { return heart(d[2]); });

	var svg = d3.select(document.body).append('svg')
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

	var marker = g.append('rect')
		.attr('width', 1)
		.attr('class', 'here-indicator')
		.attr('height', height);


	var statusDiv = d3.select(document.body).append('div').attr('class', 'status-box');
	var markerDiv = statusDiv.append('div').attr('class', 'marker-box').attr('style', 'display:none;');
	var heightText = markerDiv.append('div').attr('class', 'marker-value');
	var heartText = markerDiv.append('div').attr('class', 'marker-value');
	var speedText = markerDiv.append('div').attr('class', 'marker-value');

	var totalDiv = statusDiv.selectAll('.track-info').data(detail);
	totalDiv.enter()
		.append('div').attr('class', function(d) { return 'track-info icon-2x ' + d[0]; })
			.append('div').attr('class', function(d) { return (d[1][1] || '') })
			.html(function(d) {return d[1][0]; })
		.select(function() { return this.parentNode; })
			.append('div').attr('class', function(d) { return (d[2][1] || '') })
			.html(function(d) {return d[2][0]; });
	totalDiv.exit().remove();


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
		d3.text('/data/' + params.trk + '.gpx', gptrakkme.renderLayer);
	},
	'*': function() {
		console.log('default', arguments);
	}
}).resolve();