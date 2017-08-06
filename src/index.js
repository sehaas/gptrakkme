import './style.css';
import '../node_modules/leaflet/dist/leaflet.css';
import '../node_modules/leaflet-fullscreen/dist/leaflet.fullscreen.css';

var L = require('leaflet');
require('leaflet-easybutton');
require('leaflet-fullscreen');
var gpx2geojson = require('@mapbox/togeojson').gpx;
var d3 = require('d3');

const gptrakkme = window.gptrakkme = {};

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
L.easyButton( 'fa-star', function(){
	map.fitBounds(allLayers.getBounds());
}).addTo(map);
var hereMarker = L.circleMarker(L.latLng(0, 0), {
	color: 'darkred', weight: 1, opacity: 1,
	fillColor: 'red', fillOpacity: 1, radius: 5
}).addTo(map);


gptrakkme.renderLayer = function(str) {

	var dom = (new DOMParser()).parseFromString(str, 'text/xml');
	var geojson = gpx2geojson(dom);

	var props = geojson.features[0].properties,
		coords = geojson.features[0].geometry.coordinates,
		datePlaceHeart = props.coordTimes.map(function(d, i) {
			var hr = 0; // support tracks without HR data
			if (props.heartRates) {
				hr=props.heartRates[i];
			}
			return [new Date(d), coords[i], hr];
		}),
		bisectPlace = d3.bisector(function(d) { return d[0]; }).left,
		height = 100,
		width = 600,
		margin = 20;

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
		.domain([d3.min(datePlaceHeart, function(d) {
			return d[0];
		}), d3.max(datePlaceHeart, function(d) {
			return d[0];
		})])
		.rangeRound([0, width]);
	var elevation = d3.scaleLinear()
		.range([height, 0])
		.domain([0, d3.max(datePlaceHeart, function(d) {
			return d[1][2];
		})]);

	var elevationLine = d3.area()
		.x(function(d) { return x(d[0]); })
		.y0(height)
		.y1(function(d) { return elevation(d[1][2]); });

	var moveMarker = function(evt){
		var posX = d3.mouse(this)[0];
		d3.selectAll('.here-indicator').attr('transform', 'translate(0,0)');
		marker.attr('transform', 'translate(' + [posX, 0] + ')');
		var datum = datePlaceHeart[bisectPlace(datePlaceHeart, x.invert(posX))];
		hereMarker.setLatLng(L.latLng(datum[1][1], datum[1][0]));
	};

	var svg = d3.select('body').append('svg')
		.attr('width', width + 2 * margin)
		.attr('height', height + 2 * margin);
	var g = svg.append('g')
		.attr('class', 'chart')
		.attr('transform', 'translate(' + margin + ',' + margin + ')');
	g.append('path')
		.datum(datePlaceHeart)
		.attr('class', 'elevation-area')
		.attr('d', elevationLine);

	var marker = g.append('rect')
		.attr('width', 1)
		.attr('class', 'here-indicator')
		.attr('height', height);

	svg.append("rect")
		.attr("fill", "transparent")
		.attr('width', width)
		.attr('height', height)
		.attr('transform', 'translate(' + margin + ',' + margin + ')')
		.on("mousemove", moveMarker);
};


//d3.text('feldkirchen.gpx', renderLayer);
//d3.text('Radtour_Linz_Ampflwang.gpx', renderLayer);
d3.text('test_data/traunstein_1.8.gpx', gptrakkme.renderLayer);
