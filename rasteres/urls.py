from django.urls import path
from .views import GeoTIFFMINMAX, map_view ,FindAll,SelectValueOfPixel,SelectValueOfPolygon

urlpatterns = [
     path('geotiff/', GeoTIFFMINMAX.as_view(), name='geotiff-api'),
     path('', map_view, name='map'),
     path('findall/', FindAll.as_view(), name='find_all'),
     path('find-by-pixel/', SelectValueOfPixel.as_view(), name='select_value_of_pixel'),
     path('select-value-of-polygon/', SelectValueOfPolygon.as_view(), name='select_value_of_plygon'),
]
