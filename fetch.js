"use strict";

const https = require("node:https");
const cheerio = require("cheerio");
const fs = require("node:fs");

const en = {
  playlist:
    "https://www.youtube.com/playlist?list=PL66DIGaegedqVBwaauzKVk7DNqIFaXrN_",
  //path: "/home/alex/Videos/Полиглот сокращённый/English",
  path: "/run/user/1000/gvfs/afp-volume:host=GoFlexHome.local,user=alex,volume=alex/GoFlex Home Backup/learning/Полиглот сокращённый/English"
};

const de = {
  playlist:
    "https://www.youtube.com/playlist?list=PL66DIGaegedr605R7TbVss_p--VAPIZnD",
  //path: "/home/alex/Videos/Полиглот сокращённый/Deutsch",
  path: "/run/user/1000/gvfs/afp-volume:host=GoFlexHome.local,user=alex,volume=alex/GoFlex Home Backup/learning/Полиглот сокращённый/Deutsch"
};

const fileslist = [];
let regexp = /(.{11})(?=\.mp4$)/;

const deepSearch = (object, key, predicate) => {
  if (object.hasOwnProperty(key) && predicate(key, object[key]) === true)
    return object;

  for (let i = 0; i < Object.keys(object).length; i++) {
    let value = object[Object.keys(object)[i]];
    if (typeof value === "object" && value != null) {
      let o = deepSearch(object[Object.keys(object)[i]], key, predicate);
      if (o != null) return o;
    }
  }
  return null;
};

const fetchData = (playlist) => {
  return new Promise((resolve, reject) => {
    let dataObj = {};
    https
      .get(playlist, (res) => {
        const { statusCode } = res;
        const contentType = res.headers["content-type"];
        let error;
        if (statusCode !== 200) {
          error = new Error("Request Failed.\n" + `Status Code: ${statusCode}`);
        } else if (!/^text\/html/.test(contentType)) {
          error = new Error(
            "Invalid content-type.\n" +
              `Expected text/html but received ${contentType}`
          );
        }
        if (error) {
          console.error(error.message);
          res.resume();
          return;
        }

        res.setEncoding("utf8");
        let rawData = "";
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          try {
            const $ = cheerio.load(rawData);
            var jsonObject = [];
            $("script").each(function () {
              if ($(this).html().includes("playlistVideoListRenderer")) {
                const data = eval(
                  "const data = function(){ return " +
                    $(this).html().split("var ytInitialData = ")[1] +
                    "}; data"
                );
                dataObj = { ...data() };
                resolve(dataObj);
              }
            });
          } catch (e) {
            console.error(e.message);
          }
        });
      })
      .on("error", (e) => {
        console.error(`Got error: ${e.message}`);
        reject();
      });
  });
};

const folderList = (path) =>
  fs.readdir(path, (err, data) => {
    if (err) throw err;
    fileslist.splice(0, fileslist.length);
    data.forEach((item) => fileslist.push(item));
  });

const startRename = (langObj) => {
  folderList(langObj.path);
  fetchData(langObj.playlist).then((data) => {
    fileslist.forEach((item) => {
      const result = deepSearch(
        data,
        "videoId",
        (k, v) => v === item.match(regexp)[0]
      );
      if (result) {
        fs.rename(
          `${langObj.path}/${item}`,
          `${langObj.path}/${result.index.simpleText}_${item}`,
          (err) => {
            if (err) throw err;
            console.log("Rename complete!");
          }
        );
      }
    });
  });
};

startRename(en);