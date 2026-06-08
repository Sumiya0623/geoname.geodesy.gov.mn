import json, requests
def taxpayer_llc_name(regnum):
	url='http://info.ebarimt.mn/rest/merchant/info?regno='+str(regnum)
	response = requests.request("GET", url, verify=False)
	data = json.loads(response.text)
	if data['name']:
		return data['name']
	return False
