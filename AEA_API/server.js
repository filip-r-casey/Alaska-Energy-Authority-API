"use strict";

const { default: axios } = require("axios");
const { response } = require("express");
const express = require("express");
const pgp = require("pg-promise")();

// Constants
const PORT = 8080;
const HOST = "0.0.0.0";
const credentials = {
  host: "postgres",
  port: 5432,
  database: "root",
  user: "root",
  password: "root",
};
// App
const app = express();

const db = pgp(credentials);

app.get("/", (req, res) => {
  res.send("Hello World");
});

//sites
app.get("/sites/coord_search", (req, res) => {
  var lat = parseInt(req.query.lat);
  var lon = parseInt(req.query.lon);
  var lat_threshold = parseInt(req.query.lat_threshold);
  var lon_threshold = parseInt(req.query.lon_threshold);
  var site_response = {};

  db.any(
    "SELECT * FROM aea_sites WHERE (latitude BETWEEN $1 and $2) AND (longitude BETWEEN $3 AND $4)",
    [
      lat - lat_threshold,
      lat + lat_threshold,
      lon - lon_threshold,
      lon + lon_threshold,
    ]
  )
    .then((response) => {
      site_response = response;
      res.setHeader("Content-Type", "application/json");
      res.status(200);
      res.json({ sites: site_response });
    })
    .catch((error) => {
      res.status(404);
      res.json(error);
    });
});

app.get("/sites/name_search", (req, res) => {
  var name = req.query.name;
  db.any("SELECT * FROM aea_sites WHERE site_name = $1", [name])
    .then((response) => {
      var site_response = response;
      res.setHeader("Content-Type", "application/json");
      res.status(200);
      res.json({ sites: site_response });
    })
    .catch((error) => {
      res.status(404);
      res.json(error);
    });
});

//wind speed
app.get("/wind_speed", (req, res) => {
  function parseWindResponse(response) {
    var response_json = {};
    for (let i = 0; i < response.length; i++) {
      if (!(response[i]["site_name"] in response_json)) {
        response_json[response[i]["site_name"]] = {
          latitude: response[i]["latitude"],
          longitude: response[i]["longitude"],
          elevation: response[i]["elevation"],
          altitude: response[i]["altitude"],
          data: {
            1: {},
            2: {},
            3: {},
            4: {},
            5: {},
            6: {},
            7: {},
            8: {},
            9: {},
            10: {},
            11: {},
            12: {},
          },
        };
      } else {
        response_json[response[i]["site_name"]]["data"][response[i]["month"]][
          response[i]["hour"]
        ] = {
          prevailing_direction: response[i]["prevailing_direction"],
          speed: response[i]["speed_for_prevailing"],
        };
      }
    }
    return response_json;
  }
  if (req.query.sites == null && req.query.lat == null) {
    res.setHeader("Content-Type", "application/json");
    res.status(400);
    res.json({
      status: 400,
      title: "Insufficient request",
      message:
        "A request must include either a list of sites, or a location with latitude and longitude",
    });
  }
  if (req.query.sites != null) {
    var sites = req.query.sites.split(",");
  }
  var start = req.query.start;
  var end = req.query.end;
  var lat = parseInt(req.query.lat);
  var lon = parseInt(req.query.lon);
  var lat_threshold = parseInt(req.query.lat_threshold) || 1;
  var lon_threshold = parseInt(req.query.lon_threshold) || 1;

  if (sites == null && lat != null && lon != null) {
    // Condition to search for sites if they are not provided
    db.any(
      `SELECT * FROM aea_sites
    INNER JOIN aea_prevailing_direction_data ON aea_sites.site_name = aea_prevailing_direction_data.site_name
    WHERE (latitude BETWEEN $1 and $2) AND (longitude BETWEEN $3 and $4);`,
      [
        lat - lat_threshold,
        lat + lat_threshold,
        lon - lon_threshold,
        lon + lon_threshold,
      ]
    )
      .then((response) => {
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({ sites: parseWindResponse(response) });
      })
      .catch((error) => {
        console.error(error);
      });
  } else if (sites != null) {
    db.any(
      `SELECT * FROM aea_sites INNER JOIN aea_prevailing_direction_data ON aea_sites.site_name = aea_prevailing_direction_data.site_name WHERE aea_sites.site_name IN ($1:list)`,
      [sites]
    )
      .then((response) => {
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({ sites: parseWindResponse(response) });
      })
      .catch((error) => {
        console.error(error);
      });
  }
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
