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
import glob
import io
import base64
from PIL import Image
import numpy as np
from matplotlib import cm



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
            raster_data = np.where(raster_data == -9999, np.nan, raster_data)
            # Calculate the mean value
            max_value = np.nanmin(raster_data)
            min_value = np.nanmax(raster_data)
        # Serve the GeoTIFF file using FileResponse
        return Response({"max_value": max_value, "min_value": min_value})


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
            raster_data = np.where(raster_data == -9999, np.nan, raster_data)
            # Calculate the mean value
            max_value = np.nanmin(raster_data)
            min_value = np.nanmax(raster_data)
        # Serve the GeoTIFF file using FileResponse
        return Response({"max_value": max_value, "min_value": min_value})


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
                data.append({"path": filename, "date": date, })
        return Response({"data": data, })
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
                "date": date,
                'lat': lat,
                'lng': lng,
                'pixel_value': mean_value.item()  # Convert to list if necessary
            }

            return JsonResponse(response)


def convert_array_to_base64(data):
    # Set nodata values to transparent
    data = np.where(data == -9999, 0, data)

    # Normalize the data to the range [0, 1]
    normalized_data = (data - np.min(data)) / (np.max(data) - np.min(data))

    # Apply the rainbow color map
    colormap = cm.get_cmap('rainbow')
    colored_data = colormap(normalized_data)

    # Scale the color values to the range [0, 255]
    scaled_data = (colored_data[:, :, :3] * 255).astype(np.uint8)

    # Create an image from the colored data
    image = Image.fromarray(scaled_data)

    # Convert the image to RGBA mode to support transparency
    image = image.convert("RGBA")

    # Get the image data as a list of pixels
    pixels = list(image.getdata())

    # Modify the pixels to set nodata values to fully transparent
    modified_pixels = [(r, g, b, 0) if r == 127 and g== 0 and b == 255 else (r, g, b, a) for r, g, b, a in pixels]
    # Create a new image with the modified pixels
    modified_image = Image.new(image.mode, image.size)
    modified_image.putdata(modified_pixels)

    # Create an in-memory file-like object
    buffer = io.BytesIO()

    # Save the image to the in-memory file as PNG
    modified_image.save(buffer, format="PNG")

    # Encode the in-memory file content as base64
    base64_image = base64.b64encode(buffer.getvalue()).decode("utf-8")

    # Add the base64 header
    base64_image_with_header = "data:image/png;base64," + base64_image

    return base64_image_with_header


class SelectValueOfPolygon(APIView):
    def post(self, request):
        polygon = request.data.get('polygon')
        product = request.data.get('product')
        start_date = datetime.strptime(
            request.data.get('start_date'), "%Y-%m-%d").date()
        end_date = datetime.strptime(
            request.data.get('end_date'), "%Y-%m-%d").date()
        polygon = json.loads(polygon)
        coordinates = [[point['lng'], point['lat']] for point in polygon]
        polygon = Polygon(coordinates)

        # Replace with the actual folder path
        folder_path = 'static/' + str(product) + "/"

        tif_files = glob.glob(folder_path + '/*.tif')

        selected_files = []
        selected_dates = []

        for file_path in tif_files:
            date_string = file_path.split("_")[-3]
            file_date = datetime.strptime(date_string, "%Y%m%d").date()

            if start_date <= file_date <= end_date:
                selected_files.append(file_path)
                selected_dates.append(file_date)

        if selected_files:
            means = []
            for selected_file in selected_files:
                with rasterio.open(selected_file) as dataset:
                    image = dataset.read(1)
                    mask2 = geometry_mask(
                        [polygon], out_shape=image.shape, transform=dataset.transform, invert=True)
                    # Apply the mask to clip the image
                    out_image = image * mask2
                    out_image, out_transform = mask(
                    dataset, [polygon], crop=True)
                    out_image = out_image[0]
                    out_image_=np.where(out_image == -9999,np.nan, out_image)
                    mean_value = np.nanmean(out_image_)
                    means.append(mean_value)

            result = list(zip(means, selected_dates))
            mean_of_means = np.nanmean(means)
            min_ = np.nanmin(means)
            max_ = np.nanmax(means)
            result = [(str(mean), date) for mean, date in result]
            mean_of_means = str(mean_of_means)
            

            # Prepare the response
            response = {
                "data": result,
                "mean": mean_of_means,
                "min": min_,
                "max": max_,
                "base64": convert_array_to_base64(out_image)
            }
        else:
            response = {
                "error": "No Data"
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
    fig.update_layout(title="Mean Values Over Time",
                      xaxis_title="Date", yaxis_title="Mean Value")

    context = {
        'geotiff_path': "lst/" + geotiff_files[9],
        'plot_div': fig.to_html(full_html=False),
    }
    return render(request, 'map.html', context)
