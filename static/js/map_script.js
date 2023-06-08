
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
  
  selectValueOfPolygon(layer, polygon, selectedProduct ,selectedStartDate,selectedEndDate) {
    return new Promise((resolve, reject) => {
      // Convert the polygon data to a JSON string
      const polygonJSON = JSON.stringify(polygon);

      // Create a FormData object to send the data as multipart/form-data
      const formData = new FormData();
      formData.append("polygon", polygonJSON);
      formData.append("product", selectedProduct);
      formData.append("start_date", selectedStartDate);
      formData.append("end_date", selectedEndDate);

      // Send the AJAX request to the backend
      $.ajax({
        url: "select-value-of-polygon/",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        success: function (response) {
          layer.bindPopup(
            "<h6>Date: From" +
            selectedStartDate + " To "+ selectedEndDate+
              "</h6>" +
              "<p>Mean Value: " +
              response.mean +
              "</p>" +
              "<p>Minimum Value: " +
              response.min +
              "</p>" +
              "<p>Maximum Value: " +
              response.max +
              "</p>"
          );

          resolve(response);

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
  visualizeGeotiff(geotiffPath, map, min, max) {
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

  openModal() {
    $("#myModal").modal("show");
  },

  closeModal() {
    $("#myModal").modal("hide");
  },
  openChartModal() {
    $("#chartModal").modal("show");
  },

  closeChartModal() {
    $("#chartModal").modal("hide");
  },
  getSelectedProduct() {
    return $("#productSelect").val();
  },
  getSelectedStartDate() {
    return $("#startDatePicker").val();
  },
  getSelectedEndDate() {
    return $("#endDatePicker").val();
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
  bindChartButton(handler) {
    $("#openChart").on("click", handler);
  },
  visualizeBase64ImageOnMap(base64Image, map, polygon) {
    const image = new Image();
    image.src = base64Image;
  
    image.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
  
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);  // Clear the canvas first
      context.drawImage(image, 0, 0, image.width, image.height);
  
      const imageOverlay = L.imageOverlay(canvas.toDataURL(), polygon,{
        opacity: 0.9,
    }).addTo(map);

    map.flyToBounds(polygon, {
      duration: 1,  // Animation duration in seconds
    });
  }
},

  desplayChart(resault){
      // Extract data and labels from the response
  const data = resault.map(item => item[0]);
  const labels = resault.map(item => item[1]);

  // Create a chart using Chart.js
  const ctx = document.getElementById('chart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Mean Values',
        data: data,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
  }
};

// Controller
// Controller
const Controller = {


  init() {

    var selectedProduct ;
    var selectedStartDate ;
    var selectedEndDate ;
    var resault ;
    var base64 ;
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
       selectedProduct = View.getSelectedProduct();
       selectedStartDate = View.getSelectedStartDate();
       selectedEndDate = View.getSelectedEndDate();

       console.log(selectedStartDate,selectedEndDate)
       View.closeModal()
    });
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
        Model.selectValueOfPoint(layer, lat, lng, selectedProduct);
      } else if (shape === "polygon") {

        var polygon = layer.getLatLngs();
        Model.selectValueOfPolygon(layer, polygon[0], selectedProduct ,selectedStartDate,selectedEndDate).then((response) => {
          // Handle the data

          resault=response.data
          base64=response.base64
          View.visualizeBase64ImageOnMap(base64,map,polygon)
          console.log("Received Data:", response);
          // ... Other processing with the data
        })
        .catch((error) => {
          // Handle errors
          console.log("Error:", error);
        });
        console.log(resault)

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
        Model.selectValueOfPolygon(layer, coordinates[0], selectedProduct ,selectedStartDate,selectedEndDate).then((response) => {
          // Handle the data

          resault=response.data
          base64=response.base64
          View.visualizeBase64ImageOnMap(base64,map,coordinates)
          // ... Other processing with the data
        })
        .catch((error) => {
          // Handle errors
          console.log("Error:", error);
        });
        console.log(resault)

        // Log the coordinates
       }
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

    View.bindChartButton(() => {
      View.desplayChart(resault)
      View.openChartModal()
    });




    View.bindCloseButtonEvent(() => {

      View.closeModal();
    });

    // View.bindSelectButton(() => {
    //   var selectedProduct = View.getSelectedProduct();
    //   Model.getMaxMin(selectedProduct)
    //   .then((data)=>{
    //     View.visualizeGeotiff(selectedGeotiff, map , data["min_value"],data["max_value"]);
    //     View.closeModal();
    //   })
 
    // });
  },
};

// Initialize the controller
Controller.init();
