################## DEV config

1. Суулгалт
   sudo apt install -y python3-venv python3-dev build-essential \
    libpq-dev postgresql postgresql-contrib \
    git
   sudo apt install -y gdal-bin libgdal-dev
2. Python виртуал орчин
   python3 -m venv venv
   source venv/bin/activate
   pip install -U pip wheel
   pip install -r req.txt

3. Орчны хувьсагч (ENV)

.env:
SECRET_KEY=change-me
ALLOWED_HOSTS=point.local.nextgis.mn
DATABASE_URL=postgres://postgres:postgres@localhost:5432/point.geodesy.gov.mn

4. Static directory
   STATIC_URL=/static/
   MEDIA_URL=/media/

5. settings.py
   CORS_ALLOWED_ORIGINS=http://point.local.nextgis.mn:3008
   CSRF_TRUSTED_ORIGINS=http://point.local.nextgis.mn:3008

EMAIL_HOST_USER='no-reply@geodesy.gov.mn'
EMAIL_HOST_PASSWORD='**\*\***\*\***\*\***'
DEFAULT_FROM_EMAIL='no-reply@geodesy.gov.mn'
EMAIL_HOST='mail.gov.mn'
EMAIL_PORT=465
EMAIL_USE_SSL = True

################ PROD config

1. Орчны хувьсагч (ENV)
   .env:
   SECRET_KEY='**\*\*\*\***'
   DATABASE_NAME='point.geodesy.gov.mn'
   DATABASE_USER='**\*\*\*\***'
   DATABASE_PASSWORD='**\*\***'
   DATABASE_HOST='localhost'
   DATABASE_POST='5432'

QPAY_TOKEN_URL='https://merchant.qpay.mn/v2/auth/token'
QPAY_INVOICE_URL='https://merchant.qpay.mn/v2/invoice'
QPAY_PAYMENT_URL='https://merchant.qpay.mn/v2/payment/'
QPAY_EBARIMT_CHECK_URL='https://merchant.qpay.mn/v2/ebarimt'
QPAY_CHECK_URL='https://merchant.qpay.mn/v2/payment/check'
EBARIMT_CREATE_URL='https://merchant.qpay.mn/v2/ebarimt/create'
QPAY_USERNAME='**\*\***'
QPAY_PASSWORD='**\*\***'
GEOSERVER_USER='**\*\*\*\***'
GEOSERVER_PASSWORD='**\*\*\*\***'
GEOSERVER_DATA_DIR='/var/monpos/geoserver/data_dir'
# geoname.geodesy.gov.mn
