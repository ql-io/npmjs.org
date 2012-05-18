
var shows = exports

shows.package = function (doc, req) {
  require("monkeypatch").patch(Object, Date, Array, String)

  var semver = require("semver")
    , code = 200
    , headers = {"Content-Type":"application/json"}
    , body = null

  delete doc.ctime
  delete doc.mtime
  if (doc.versions) Object.keys(doc.versions).forEach(function (v) {
    delete doc.versions[v].ctime
    delete doc.versions[v].mtime
  })

  if (doc.url) {
    // the package specifies a URL, redirect to it
    var url = doc.url
    if (req.query.version) {
      url += '/' + req.query.version // add the version to the URL if necessary
    }
    headers.Location = url
    body = { location: url, _rev: doc._rev }
    body = req.query.jsonp
         ? req.query.jsonp + "(" + JSON.stringify(body) + ")"
         : JSON.stringify(body)
    return {
      code : 301,
      body : body,
      headers : headers
    }
  }

  // legacy kludge
  if (doc.versions) for (var v in doc.versions) {
    var clean = semver.clean(v)
    doc.versions[v].directories = doc.versions[v].directories || {}
    if (clean !== v) {
      var p = doc.versions[v]
      delete doc.versions[v]
      p.version = v = clean
      doc.versions[clean] = p
    }
    if (doc.versions[v].dist.tarball) {
      var t = doc.versions[v].dist.tarball
      t = t.replace(/^https?:\/\/[^\/:]+(:[0-9]+)?/, '')
      if (!t.match(/^\/[^\/]+\/_design\/app\/_rewrite/)) {
        doc.versions[v].dist.tarball = t
        // doc.versions[v].dist._headers = req.headers
        // doc.versions[v].dist._query = req.query
        // doc.versions[v].dist._path = req.path
        // doc.versions[v].dist._req = req

        var basePath = req.requested_path || ""
        if (basePath.indexOf("_show") === -1) basePath = ""
        else {
          basePath = "/" + basePath.slice(0, basePath.indexOf("_show"))
                             .concat(["_rewrite"]).join("/")
        }

        var h = "http://" + req.headers.Host

        doc.versions[v].dist.tarball = h + "/registry/_design/app/_rewrite" + basePath + t
      }
    }
  }
  if (doc["dist-tags"]) for (var tag in doc["dist-tags"]) {
    var clean = semver.clean(doc["dist-tags"][tag])
    if (!clean) delete doc["dist-tags"][tag]
    else doc["dist-tags"][tag] = clean
  }
  // end kludge

  if (req.query.version) {
    var ver = req.query.version
    // if not a valid version, then treat as a tag.
    if ((!(ver in doc.versions) && (ver in doc["dist-tags"]))
        || !semver.valid(ver)) {
      ver = doc["dist-tags"][ver]
    }
    body = doc.versions[ver]
    if (!body) {
      code = 404
      body = {"error" : "version not found: "+req.query.version}
    }
  } else {
    body = doc
    for (var i in body) if (i.charAt(0) === "_" && i !== "_id" && i !== "_rev") {
      delete body[i]
    }
    for (var i in body.time) {
      if (!body.versions[i]) delete body.time[i]
      else body.time[i] = new Date(Date.parse(body.time[i])).toISOString()
    }
  }

  body = req.query.jsonp
       ? req.query.jsonp + "(" + JSON.stringify(body) + ")"
       : toJSON(body)

  return {
    code : code,
    body : body,
    headers : headers,
  }
}

