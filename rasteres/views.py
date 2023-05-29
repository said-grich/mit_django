from django.http import FileResponse
from django.shortcuts import render
import numpy as np
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers
import os
from datetime import datetime
import plotly.graph_objects as go
import os
import rasterio
from django.http import JsonResponse
import numpy as np
from rasterio.features import geometry_mask
from rasterio.mask import mask
from shapely import geometry
import pyproj
from shapely.geometry import Polygon
import json

class GeoTIFFClip(APIView):
    def post(self, request, format=None):
        polygon = request.data.get('polygon')
        geotiff_path = request.data.get('geotiff')
        # Get the path to the GeoTIFF file
        geotiff_path = "static/lst/"+geotiff_path
        with rasterio.open(geotiff_path) as src:
            # Retrieve the geometry coordinates
                raster_data = src.read(1)
                metadata = src.meta
                print(metadata)
                raster_data=np.where(raster_data == -9999, np.nan, raster_data)
                # Calculate the mean value
                max_value = np.nanmin(raster_data)
                min_value = np.nanmax(raster_data)
        # Serve the GeoTIFF file using FileResponse
        return Response({"max_value": max_value,"min_value":min_value})
    
    
    

class GeoTIFFMINMAX(APIView):
    def post(self, request, format=None):
        geotiff_path = request.data.get('geotiff')
        
        # Get the path to the GeoTIFF file
        geotiff_path = "static/lst/"+geotiff_path
        with rasterio.open(geotiff_path) as src:
            # Retrieve the geometry coordinates
                raster_data = src.read(1)
                metadata = src.meta
                print(metadata)
                raster_data=np.where(raster_data == -9999, np.nan, raster_data)
                # Calculate the mean value
                max_value = np.nanmin(raster_data)
                min_value = np.nanmax(raster_data)
        # Serve the GeoTIFF file using FileResponse
        return Response({"max_value": max_value,"min_value":min_value})

class FindAll(APIView):
    def get(self, request, format=None):
        directory = 'lst'  # Directory name within static directory
        static_path = os.path.join('static', directory)
        data = []
        # Retrieve all GeoTIFF files in the directory
        geotiff_files = []
        for filename in os.listdir(static_path):
            file_path = os.path.join(static_path, filename)
            if os.path.isfile(file_path) and filename.lower().endswith('.tif'):
                    date_string = filename.split("_")[-3]
                    date = datetime.strptime(date_string, "%Y%m%d").date()
                    data.append({"path":filename,"date":date,})        
        return Response({"data": data,})
        # Serve the GeoTIFF file using FileResponse
        
class SelectValueOfPixel(APIView):
    def post(self, request):
        # Get the latitude and longitude from the request data
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        lat = float(lat)
        lng = float(lng)
        geotiff_path = request.data.get('geotiff')
        date_string = geotiff_path.split("_")[-3]
        date = datetime.strptime(date_string, "%Y%m%d").date()
        # Open the GeoTIFF file using Rasterio
        with rasterio.open("static/lst/"+geotiff_path) as dataset:
            row, col = dataset.index(lng, lat)
            # Read the pixel value at the specified coordinates
            pixel_value = dataset.read(1, window=((row, row+1), (col, col+1)))
            mean_value = pixel_value.mean()
            # You can perform additional operations with the pixel value if needed
            # Prepare the response
            response = {
                "date":date,
                'lat': lat,
                'lng': lng,
                'pixel_value': mean_value.item()  # Convert to list if necessary
            }

            return JsonResponse(response)

class SelectValueOfPolygon(APIView):
    def post(self, request):
        polygon = request.data.get('polygon')
        geotiff_path = request.data.get('geotiff')
        polygon = json.loads(polygon)
       
        coordinates = [[point['lng'], point['lat']] for point in polygon]
        polygon = Polygon(coordinates)
        date_string = geotiff_path.split("_")[-3]
        date = datetime.strptime(date_string, "%Y%m%d").date()
        # Open the GeoTIFF file using Rasterio
        with rasterio.open("static/lst/" + geotiff_path) as dataset:
            mask = geometry_mask([polygon], out_shape=dataset.shape, transform=dataset.transform, invert=True)
            masked_data = dataset.read(1, masked=True)
            included_values = np.array(masked_data[mask])

            included_values=np.where(included_values == -9999, np.nan, included_values)
            # Compute the mean of the included pixel values

            # You can perform additional operations or calculations on the polygon values if needed
            # For example, calculating the mean, minimum, maximum, etc.
            mean_value = np.nanmean(included_values)
            min_value = np.nanmin(included_values)
            max_value = np.nanmax(included_values)

            # Prepare the response
            response = {
                "date":date,
                'mean_value': mean_value,
                'min_value': min_value,
                'max_value': max_value
            }

            return Response(response)



             
           
def map_view(request):
    directory = 'lst'  # Directory name within static directory
    static_path = os.path.join('static', directory)
    geotiff_files = []
    mean_values = []
    dates = []
    # Retrieve all GeoTIFF files in the directory
    geotiff_files = []
    for filename in os.listdir(static_path):
        file_path = os.path.join(static_path, filename)
        if os.path.isfile(file_path) and filename.lower().endswith('.tif'):
            geotiff_files.append(filename)
            with rasterio.open("static/lst/"+filename) as src:
            # Retrieve the geometry coordinates
                raster_data = src.read(1)
                # Calculate the mean value
                mean_value = np.mean(raster_data)
                mean_values.append(mean_value)
                date_string = filename.split("_")[-3]
                date = datetime.strptime(date_string, "%Y%m%d").date()
                dates.append(date)
    fig = go.Figure(data=go.Scatter(x=dates, y=mean_values))
    fig.update_layout(title="Mean Values Over Time", xaxis_title="Date", yaxis_title="Mean Value")
    
    context = {
        'geotiff_path': "lst/" + geotiff_files[9],
        'plot_div': fig.to_html(full_html=False),
    }
    return render(request, 'map.html', context)