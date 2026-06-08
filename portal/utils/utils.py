import os, logging
import base64,qrcode
from io import BytesIO
import base64
from django.template.loader import render_to_string
from django.core.mail import EmailMessage
from django.conf import settings
from celery import shared_task


logger = logging.getLogger(__name__)
from django.conf import settings


MIME_TYPES  = {
	'pdf': 'application/pdf',
	'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'csv': 'text/csv',
	'doc': 'application/msword',  # Microsoft Word 97-2003
	'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # Microsoft Word (OpenXML)
	'txt': 'text/plain',  # Plain text
	'ppt': 'application/vnd.ms-powerpoint',  # PowerPoint 97-2003
	'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',  # PowerPoint (OpenXML)
	'jpg': 'image/jpeg',  # JPEG images
	'jpeg': 'image/jpeg',
	'png': 'image/png',  # PNG images
	'zip': 'application/zip',  # ZIP archives
	'rar': 'application/vnd.rar',  # RAR archives
}

def _log_mail(category, to_email, to_user, subject, mail_txt, status, error=None):
	"""Илгээсэн имэйл бүрийг MailLog-д бүртгэнэ (мэдэгдлийн цэс, админ хяналт).

	Бүртгэл амжилтгүй болсон ч имэйл илгээх процессыг хэзээ ч таслахгүй.
	"""
	try:
		from core.models import MailLog
		from core.mail_constants import get_mail_category
		MailLog.objects.create(
			category=get_mail_category(category),
			to_email=to_email,
			to_user=to_user or '',
			subject=subject,
			body=mail_txt,
			status=status,
			error=error,
		)
	except Exception:
		logger.exception("MailLog бүртгэхэд алдаа гарлаа: to=%s subject=%s", to_email, subject)


@shared_task(rate_limit="110/h")
def sendmail_sendgrid(to_email, to_user, subject, mail_txt, attach=None, category=None):
	# delay_seconds=36
	try:
		texthtml = render_to_string('account/mail_part_sendgrid.html', {
			'message': mail_txt,
			'user': to_user,
		})
		email = EmailMessage(
			subject=subject,
			body=texthtml,
			from_email=f'Систем администратор <{settings.DEFAULT_FROM_EMAIL}>',
			to=[to_email],
		)
		email.content_subtype = "html"  # Specify HTML content
		mime_types = {
			'pdf': 'application/pdf',
			'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'csv': 'text/csv',
			'doc': 'application/msword',  # Microsoft Word 97-2003
			'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  # Microsoft Word (OpenXML)
			'txt': 'text/plain',  # Plain text
			'ppt': 'application/vnd.ms-powerpoint',  # PowerPoint 97-2003
			'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',  # PowerPoint (OpenXML)
			'jpg': 'image/jpeg',  # JPEG images
			'jpeg': 'image/jpeg',
			'png': 'image/png',  # PNG images
			'zip': 'application/zip',  # ZIP archives
			'rar': 'application/vnd.rar',  # RAR archives
		}
		if attach:
			if isinstance(attach, str):
				attach = [attach]
			for file_path in attach:
				if not os.path.exists(file_path):
					continue
				ext = file_path.split('.')[-1].lower()
				mime_type = mime_types.get(ext, 'application/octet-stream')  # Default MIME type
				with open(file_path, 'rb') as file:
					email.attach(
                        filename=os.path.basename(file_path),
                        content=file.read(),
                        mimetype=mime_type
                    )
		email.send()
		print(f"Email sent successfully to {to_email}.")
		_log_mail(category, to_email, to_user, subject, mail_txt, 'sent')

	except Exception as e:
		print(f"Error sending email to {to_email}: {str(e)}")
		_log_mail(category, to_email, to_user, subject, mail_txt, 'failed', error=str(e))
		sendmail_sendgrid('admin@geodesy.gov.mn', 'Системийн имэилийн алдаа', f'{to_email} имэйлтэй ({to_user}) {subject} мэдэгдэл хүргүүлэхэд алдаа үүслээ', str(e))

def save_qr_image(qr_image_base64, filename):
    img_data = base64.b64decode(qr_image_base64)
    relative_path = os.path.join('qr_codes', filename)
    full_file_path = os.path.join(settings.MEDIA_ROOT, relative_path)
    os.makedirs(os.path.dirname(full_file_path), exist_ok=True)
    with open(full_file_path, 'wb') as f:
        f.write(img_data)
    return relative_path

def generate_qr_code_base64(obj):
    """Generate QR code for task and return base64 string."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(obj.ebarimt_qr_data)  # Assuming ebarimt_qr_data is the QR code data
    qr.make(fit=True)

    # Save QR code image to a BytesIO object
    img_io = BytesIO()
    img = qr.make_image(fill='black', back_color='white')
    img.save(img_io, format='PNG')
    img_io.seek(0)

    # Encode the image to base64
    base64_img = base64.b64encode(img_io.getvalue()).decode('utf-8')
    return base64_img