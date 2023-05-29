
// Model
const Model = {
  getColorScale() {
    const numColors = 7; // Number of colors in the rainbow scale
    const colors = [];
    const startColor = chroma('#9400D3'); // Starting color of the rainbow
    const endColor = chroma('#FF0000'); // Ending color of the rainbow
    
    for (let i = 0; i < numColors; i++) {
      const color = chroma.mix(startColor, endColor, i / (numColors - 1));
      colors.push(color.hex());
    }
  
    const colorScale = chroma.scale(colors);
    return colorScale;
  },
  

  getDataFromServer() {
    return new Promise((resolve, reject) => {
      $.ajax({
        url: "findall/",
        type: "GET",
        dataType: "json",
        success: function (response) {
          resolve(response.data);
        },
        error: function (error) {
          reject(error);
        },
      });
    });
  }, getMaxMin(selectedGeotiff) {
    return new Promise((resolve, reject) => {
      $.ajax({
        url: "geotiff/",
        type: "POST",
        data: {
          geotiff: selectedGeotiff, // Replace with the appropriate geotiff value
        },
        dataType: "json",
        success: function (response) {
          const max_value = response.max_value;
          const min_value = response.min_value;
          console.log(min_value,max_value)
          resolve({ max_value, min_value });
        },
        error: function (error) {
          reject(error);
        },
      });
    });
  },
  
  selectValueOfPolygon(layer, polygonData, geotiffFile) {
    return new Promise((resolve, reject) => {
      // Convert the polygon data to a JSON string
      const polygonJSON = JSON.stringify(polygonData);

      // Create a FormData object to send the data as multipart/form-data
      const formData = new FormData();
      formData.append("polygon", polygonJSON);
      formData.append("geotiff", geotiffFile);

      // Send the AJAX request to the backend
      $.ajax({
        url: "select-value-of-polygon/",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
          layer.bindPopup(
            "<h4>Date: " +
              response.date +
              "</h4>" +
              "<p>Mean Value: " +
              response.mean_value +
              "</p>" +
              "<p>Minimum Value: " +
              response.min_value +
              "</p>" +
              "<p>Maximum Value: " +
              response.max_value +
              "</p>"
          );
        },
        error: function (error) {
          console.log("Error:", error);
        },
      });
    });
  },
  selectValueOfPoint(layer, lat, lng, selectedGeotiff) {
    // Send AJAX request to the backend
    $.ajax({
      url: "find-by-pixel/",
      type: "POST",
      data: {
        lat: lat,
        lng: lng,
        geotiff: selectedGeotiff,
      },
      dataType: "json",
      success: function (response) {
        layer.bindPopup(
          "<h6>Date: " +
            response.date +
            "</h6>" +
            "<p>Coordinates: (" +
            lat.toFixed(2) +
            ", " +
            lng.toFixed(2) +
            ")</p>" +
            "<p>Value: " +
            response.pixel_value.toFixed(2) +
            "</p>"
        );
      },
      error: function (error) {
        console.log("Error:", error);
      },
    });
  },

  generateLegend(minValue, maxValue) {
    const legend = L.control({ position: "bottomright" });
  
    legend.onAdd = function (map) {
      const div = L.DomUtil.create("div", "legend");
      div.style.background = "#FFF";
      div.style.opacity = "0.9";
      div.style.padding = "20px";
  
      const colorScale = chroma.scale([ "red",'yellow',"orange","green",'blue']).domain([minValue, maxValue]).mode('lrgb');
      const numGrades = 9; // Number of color grades
      const step = (maxValue - minValue) / numGrades;
  
      for (let i = 0; i < numGrades; i++) {
        const gradeValue = minValue + i * step;
        const color = colorScale(gradeValue).hex();
        const nextGradeValue = gradeValue + step;
  
        div.innerHTML +=
          '<i style="background:' + color + '"></i> ' +
          gradeValue.toFixed(2) + (nextGradeValue ? '&ndash;' + nextGradeValue.toFixed(2) + '<br>' : '+');
      }
  
      return div;
    };
  
    return legend;
  },
  
};

// View
const View = {
  visualizeGeotiff(geotiffPath, map,min ,max) {
    var geotiffLayer = L.leafletGeotiff("static/lst/" + geotiffPath, {
      band: 0,
      name: "LST",
      opacity: 0.2,
      renderer: L.LeafletGeotiff.plotty({
        displayMin: max,
        displayMax: min,
        colorScale: "rainbow",
        clampLow: false,
        clampHigh: true,
        opacity: 0.2,
      }),
    }).addTo(map);


    if (this.legend) {
      this.legend.remove();
    }

    this.legend = Model.generateLegend(min, max);
    this.legend.addTo(map);
  },

  openModal(data) {
    var selectOptions = "";

    for (var i = 0; i < data.length; i++) {
      var path = data[i].path;
      var date = data[i].date;
      selectOptions += '<option value="' + path + '">' + path + "</option>";
    }

    $("#fileSelect").html(selectOptions);
    $("#myModal").modal("show");
  },
  closeModal() {
    $("#myModal").modal("hide");
  },
  getSelectedFile() {
    return $("#fileSelect").val();
  },

  bindFileButtonEvent(handler) {
    $("#fileButton").on("click", handler);
  },

  bindCloseButtonEvent(handler) {
    $("#closeButton, .close").on("click", handler);
  },

  bindSelectButton(handler) {
    $("#selectFileBtn").on("click", handler);
  },
};

// Controller
// Controller
const Controller = {


  init() {
    
    const map = L.map("map", {
      minZoom: 0,
      maxZoom: 20,
    }).setView([0, 0], 3);

    L.tileLayer(
      "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2FhZDA2IiwiYSI6ImNrdG90OGNvaDBmdngydm55djcwcjN3YmIifQ.Yo8P8RxM363E0KEf39cmtA",
      {
        attribution:
          'Map data &copy; <a href="https://www.mapbox.com/">Mapbox</a>',
        maxZoom: 22,
        tileSize: 512,
        zoomOffset: -1,
        accessToken:
          "pk.eyJ1Ijoic2FhZDA2IiwiYSI6ImNrdG90OGNvaDBmdngydm55djcwcjN3YmIifQ.Yo8P8RxM363E0KEf39cmtA",
      }
    ).addTo(map);

    var drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    var drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
      },
      draw: {
        polygon: true,
        polyline: false,
        rectangle: true,
        circle: false,
        marker: true,
        circlemarker: false,
      },
    });
    map.addControl(drawControl);

    View.bindSelectButton(() => {
      var selectedGeotiff = View.getSelectedFile();
      map.on("draw:created", function (e) {
        var layer = e.layer;
        drawnItems.addLayer(layer);
        const shape = e.layerType;

        if (shape === "marker") {
          // Retrieve the coordinates of the selected point
          var latLng = layer.getLatLng();
          var lat = latLng.lat;
          var lng = latLng.lng;

          // Update the popup content with data from the backend
          Model.selectValueOfPoint(layer, lat, lng, selectedGeotiff);
        } else if (shape === "polygon") {
          var polygon = layer.getLatLngs()[0];

          Model.selectValueOfPolygon(layer, polygon, selectedGeotiff);
        } else if (shape === "rectangle") {
          const bounds = layer.getBounds();
          // Create a Polygon from the rectangle bounds
          const polygon = L.polygon([
            bounds.getSouthWest(),
            bounds.getNorthWest(),
            bounds.getNorthEast(),
            bounds.getSouthEast(),
          ]);

          // Access the coordinates of the polygon
          const coordinates = polygon.getLatLngs();

          // Log the coordinates
          Model.selectValueOfPolygon(layer, coordinates[0], selectedGeotiff);        }
      });

    });

    View.bindFileButtonEvent(() => {
      Model.getDataFromServer()
        .then((data) => {
          View.openModal(data);
        })
        .catch((error) => {
          console.log("Error:", error);
        });
    });

    View.bindCloseButtonEvent(() => {
      View.closeModal();
    });

    View.bindSelectButton(() => {
      var selectedGeotiff = View.getSelectedFile();
      Model.getMaxMin(selectedGeotiff)
      .then((data)=>{
        View.visualizeGeotiff(selectedGeotiff, map , data["min_value"],data["max_value"]);
        View.closeModal();
      })
 
    });
  },
};

// Initialize the controller
Controller.init();
