
from pyproj import Proj, Transformer

def m100kl(val, step, long):
	"""long-r nomeklatur oloh"""
	counter = 0
	while val < long:
		counter = counter+1
		val = val+step
	return counter

def m100kb(val, step, lat):
	"""lat-r nomeklatur oloh"""
	counter = 0
	while val < lat:
		counter = counter+1
		val = val+step
	return counter

def nomek(final_x, final_y, final_z):
	lat, lon, _=cartesian_to_geodetic(final_x, final_y, final_z)
	"""nomeklatur oloh heseg."""
	dictb = {'I': 40, 'K': 44, 'L': 48, 'M': 52,'N': 56}
	dicl = {'44': 84, '45': 90, '46': 96,
			'47': 102, '48': 108, '49': 114, '50': 120}
	nom1, nom2 = [], []
	b_deg, l_deg = int(lat), int(lon)
	b_min, l_min = int(float(lat-b_deg)*60), int(float(lon-l_deg)*60)
	b_sec, l_sec = float(lat-b_deg-b_min/60) * \
		3600, float(lon-l_deg-l_min/60)*3600
	for key, valb in dictb.items():
		if b_deg+b_min/60+b_sec/3600 < valb:
			nom1 = key
			counter = m100kb(valb-4, 20/60, lat)
			break
	for key, vall in dicl.items():
		if l_deg+l_min/60+l_sec/3600 < vall:
			nom2 = key
			counter1 = m100kl(vall-6, 30/60, lon)
			break
	nomek=str((nom1+'-'+nom2+'-'+str((12-counter)*12+counter1)))
	return nomek

def cartesian_to_geodetic(x, y, z):
	transformer = Transformer.from_crs("epsg:4978", "epsg:4326", always_xy=True)
	lon, lat, height = transformer.transform(x, y, z)
	return lat, lon, height

def ddm_to_dd(ddm_str):
	"""Convert Degrees and Decimal Minutes (DDM) to Decimal Degrees (DDD)."""
	try:
		parts = ddm_str.strip().split()
		if len(parts) == 2:
			degrees = float(parts[0])
			minutes = float(parts[1])
			decimal_degrees = degrees + minutes / 60
			return decimal_degrees
	except (ValueError, IndexError) as e:
		print(f"Error in ddm_to_dd conversion: {e}")
		return None
	
def dms_to_dd(dms_str):
	"""Convert Degrees, Minutes, and Seconds (DMS) to Decimal Degrees (DDD)."""
	try:
		parts = dms_str.strip().split()
		if len(parts) == 3:
			degrees = float(parts[0])
			minutes = float(parts[1])
			seconds = float(parts[2])
			decimal_degrees = degrees + (minutes / 60) + (seconds / 3600)
			return decimal_degrees
	except (ValueError, IndexError) as e:
		print(f"Error in dms_to_dd conversion: {e}")
		return None

def dd_to_ddm(decimal_degrees, precision=3):
	"""Convert Decimal Degrees (DDD) to Degrees and Decimal Minutes (DDM)."""
	try:
		decimal_degrees=str(decimal_degrees)
		parts = decimal_degrees.strip().split()
		if len(parts) == 1:
			degrees = int(decimal_degrees)
			minutes = (decimal_degrees - degrees) * 60
			minutes_rounded = round(minutes, precision)
			return f"{degrees} {minutes_rounded}"
	except ValueError:
		return None

def dd_to_dms(decimal_degrees, precision=3):
    """Convert Decimal Degrees (DDD) to Degrees, Minutes, and Seconds (DMS)."""
    try:
        degrees = int(decimal_degrees)
        minutes = int((decimal_degrees - degrees) * 60)
        seconds = (decimal_degrees - degrees - minutes / 60) * 3600
        seconds_rounded = round(seconds, precision)
        return degrees,minutes,seconds_rounded
    except ValueError:
        return None

def utm_zone_to_string(lon, lat):
    zone_number = (int((lon + 180) / 6) % 60) + 1
    hemisphere = 'N' if lat >= 0 else 'S'
    utm_zone_string = f"{zone_number}{hemisphere}"
    return utm_zone_string

def rounder(too, dec):
	""" тайланд зориулж таслалаас хойш 5 орон таслана """
	return str(round(float(too),dec))

def geodetic_to_utm(lon,lat):
	zone_number = int((lon + 180) / 6) + 1
	print(zone_number,lon,lat)
	if lat >= 0:
		epsg_code = 32600 + zone_number
	else:
		epsg_code = 32700 + zone_number
	utm_proj = Proj(proj='utm', zone=zone_number, ellps='WGS84', south=lat<0)
	easting, northing = utm_proj(lon, lat)
	return easting, northing, utm_zone_to_string(lon, lat)

def utm_to_geodetic(easting, northing, epsg_code):
    utm_proj = Proj(f"epsg:{epsg_code}")
    wgs84_proj = Proj("epsg:4326")
    transformer = Transformer.from_proj(utm_proj, wgs84_proj)
    lon, lat = transformer.transform(easting, northing)
    return lat, lon

def geodetic_to_cartesian(lat, lon, height):
    wgs84_proj = Proj(proj="latlong", datum="WGS84")
    ecef_proj = Proj(proj="geocent", datum="WGS84")
    transformer = Transformer.from_proj(wgs84_proj, ecef_proj)
    x, y, z = transformer.transform(lon, lat, height)
    return x, y, z

def ecef_to_geodetic(x,y,z):
	ecef_to_geodetic = Transformer.from_crs("EPSG:4978", "EPSG:4326", always_xy=True)
	lon, lat, height = ecef_to_geodetic.transform(x, y, z)
	return lon, lat, height

def geoid_reader(b_in,l_in,z_in):
	from core.models import Mongeoid
	""" Геоид тооцоолол хийнэ """
	step=0.05
	min_lat = int(b_in) - 1
	min_long = int(l_in) - 1
	while b_in-min_lat>step:
		min_lat=min_lat+step
	while l_in-min_long>step:
		min_long=min_long+step
	lat_1=round(min_lat,2)
	lat_2=round(min_lat+step,2)
	long_1=round(min_long,2)
	long_2=round(min_long+step,2)
	dh1=Mongeoid.objects.values_list('dh', flat=True).filter(b__contains=str(lat_1),l__contains=str(long_1)).first()
	dh2=Mongeoid.objects.values_list('dh', flat=True).filter(b__contains=str(lat_1),l__contains=str(long_2)).first()
	dh3=Mongeoid.objects.values_list('dh', flat=True).filter(b__contains=str(lat_2),l__contains=str(long_1)).first()
	dh4=Mongeoid.objects.values_list('dh', flat=True).filter(b__contains=str(lat_2),l__contains=str(long_2)).first()
	points=((lat_1,long_1,dh1),(lat_1,long_2,dh2),(lat_2,long_1,dh3),(lat_2,long_2,dh4))
	mongeoid=bilinear_interpolation(b_in, l_in, points)
	if z_in==0:
		return(float(mongeoid))
	else:
		return(float(z_in)-float(mongeoid))

####### BILINEAR ARGAAR BODOH FUNCTION#########
##https://rosettacode.org/wiki/Bilinear_interpolation
def bilinear_interpolation(x_in, y_in, points):
	""" солбицлын интерполяци хийнэ """
	points = sorted(points)
	(x_1, y_1, q11), (_x_1, y_2, q12), (x_2, _y_1, q21), (_x_2, _y_2, q22) = points
	if x_1 != _x_1 or x_2 != _x_2 or y_1 != _y_1 or y_2 != _y_2:
		raise ValueError('points do not form a rectangle')
	if not x_1 <= x_in <= x_2 or not y_1 <= y_in <= y_2:
		raise ValueError('(x, y) not within the rectangle')
	return (q11 * (x_2 - x_in) * (y_2 - y_in) +
			q21 * (x_in - x_1) * (y_2 - y_in) +
			q12 * (x_2 - x_in) * (y_in - y_1) +
			q22 * (x_in - x_1) * (y_in - y_1)
		   ) / ((x_2 - x_1) * (y_2 - y_1) + 0.0)
