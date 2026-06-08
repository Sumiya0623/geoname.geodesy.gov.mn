from rest_framework.response import Response

from portal.utils.rsp.cException import CException
from portal.utils.rsp.info import info

def success_fn(get_response):
    ''' Амжилттай болсон return хийх нэг бүтэц
    '''

    def _send_data(data, status=200):
        '''
            Амжилттай болсон success датаг буцаах нь
            Parameters:
            * data: any
                Мэдээлэлтэй хамт буцаах дата
        '''

        return Response(
            {
                "success": True,
                "data": data,
                "error": "",
            },
            status=status
        )


    def _send_info(info_code, *args):
        '''
            Амжилттай болсон success мэдээллийг буцаах нь

            Parameters:
            * ``info_code``: ``str``
                Info мэдээллийн code нь
            * args: str
                info ний мэдээлэлд оноож өгөх үгнүүд
        '''

        #   message дээр argument ээр ирсэн үгийг оноож өгөх нь
        info[info_code]['message'] = info[info_code]['message'].format(*args)
        status_code = info[info_code]['status_code'] or 201

        return Response(
            {
                "success": True,
                "error": "",
                "info": info[info_code]
            },
            status=status_code
        )


    def _send_rsp(info_code, data, *args):
        '''
            Амжилттай болсон success мэдээллийг датаны хамт буцаах нь
            Parameters:
            * info_code: str
                Info мэдээллийн code нь
            * data: any
                Мэдээлэлтэй хамт буцаах дата
            * args: str
                info ний мэдээлэлд оноож өгөх үгнүүд
        '''

        #   message дээр argument ээр ирсэн үгийг оноож өгөх нь
        info[info_code]['message'] = info[info_code]['message'].format(*args)
        status_code = info[info_code]['status_code'] or 201

        return Response(
            {
                "success": True,
                "data": data,
                "error": "",
                "info": info[info_code]
            },
            status=status_code
        )


    def _send_error(error_code, *args):
        ''' Алдааны мэссэжийг ажиллуулах

            * ``error_code - str`` Алдааны код
            * ``args - obj`` Динамик агуулгыг буцаах
        '''
        return CException(error_code, *args)


    def middleware(request):

        #  view үүд рүү очих request дотор response буцаах функцийг оноосон нь
        request.send_data = _send_data
        request.send_info = _send_info
        request.send_rsp = _send_rsp
        request.send_error = _send_error

        response = get_response(request)
        return response

    return middleware
