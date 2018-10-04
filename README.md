# gptrakkme

A single page webapp for GPX visualization.

## Installing

```
git clone https://github.com/sehaas/gptrakkme.git
cd gptrakkme
npm install
```

## Running

Place your track in the `test_data` folder and start the tool

```
npm start
```

Open your browser at `http://localhost:8080/r/traunstein_20170801`

### URL Pattern

`/r/<gpx-track-name>` opens a single gpx track.

`/<trip-name>` opens a trip file and loads all tracks.

`/d/[YYYY-MM-DD]/<name1>[,<nameX>]` loads multiple tracks with predefined filename pattern.

e.g. `/d/2018-09-11/Linz,Ottensheim` loads `Track_2018-09-11_Linz.gpx` and `Track_2018-09-11_Ottensheim.gpx`

## Versioning

1.0.0 Initial release

## Authors

* **Sebastian Haas** - *Initial release* - [sehaas](https://github.com/sehaas)

See also the list of [contributors](https://github.com/sehaas/gptrakkme/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
