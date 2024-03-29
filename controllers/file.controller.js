require('moment-timezone');

const RequestQueue = require('node-request-queue');
const moment = require('moment');
const fs = require('fs');
const jsdom = require("jsdom");
const excel = require('excel4node');
const { JSDOM } = jsdom;
const now = moment()


const processFile = ((req, res) => {
    try {
        var file = req.file;  

        if(!file) {
            throw "Arquivo não encontrado."
        }

        if(file && file.mimetype != "text/html"){
            throw "Formato de arquivo inválido. É esperado um arquivo HTML.";
        }

        const data = Buffer.from(file.buffer).toString("utf-8");
        const { window } = new JSDOM(data);
        const { document } = (new JSDOM('')).window;
        global.document = document;    
        var $ = jQuery = require('jquery')(window);

        var longDateFormat  = 'DD/MM/yyyy';
        var hourFormat  = 'HH:mm:ss';
        var arrayUniqueIPAddress = [];
        var arrayIPAddress = [];
        var arrayIPDate = [];
        var arrayIPAddressFormated = [];
        var arrayIPDateFormated = [];
        var arrayIPHourFormated = [];
        var arrayRequests = [];
        var arrayIPResult = [];

        //#############################################################################################################
        //LÊ E SEPARA TODOS OS IP'S E DATAS RETORNADAS PELO FACEBOOK EM DUAS ARRAYS SEPARADAS
        //#############################################################################################################
        console.log('Lendo e tratando arquivo HTML...');
        
        $("th:contains('IP Address')").each(function( index ) {
            arrayIPAddress.push($("td", $(this).parent()).text());
        });

        $("th:contains('Time')").each(function( index ) {
            arrayIPDate.push(new Date($("td", $(this).parent()).text()));
        });

        if(arrayIPDate.length == 0 || arrayIPAddress.length == 0) {
            throw "Não foram encontrados IP's e/ou datas a serem tratados.";
        }

        //#############################################################################################################
        //TRATA TODAS AS DATAS PARA O FORMATO GMT-3
        //#############################################################################################################
          
        console.log('Convertendo datas para o padrão brasileiro...');

        $.each(arrayIPDate, function( index, value ){
            arrayIPDateFormated.push(moment(value).tz("America/Sao_Paulo").format(longDateFormat));
            arrayIPHourFormated.push(moment(value).tz("America/Sao_Paulo").format(hourFormat));
        });

        //#############################################################################################################
        //TRATA TODAS OS IPS PARA 4 CASAS
        //#############################################################################################################
        console.log('Formatando IPV6....');
        $.each(arrayIPAddress, function( index, value ){
            
            var IPAddressFormated;

            // SE FOR IPV4
            if(value.indexOf(":") == -1) {
                IPAddressFormated = value;
            }

            // SE FOR IPV6
            else {
                var arrayIPParts = value.split(":");
                var arrayIPPartsFormated = [];

                $.each(arrayIPParts, function( index, value ){
                    if(value.length < 2) {
                        value = "000" + value;
                    } else if(value.length < 3) {
                        value = "00" + value;
                    } else if(value.length < 4) {
                        value = "0" + value;
                    }
                    
                    arrayIPPartsFormated.push(value);
                }); 
                IPAddressFormated = arrayIPPartsFormated.join(":");
            }        

            //ADICIONA NA LISTA OS IPS QUE NÃO SÃO REPETIDOS, PARA FINS DE PESQUISA NO WHOIS
            arrayIPAddressFormated.push(IPAddressFormated);
            if(arrayUniqueIPAddress.indexOf(IPAddressFormated) == -1) {
                arrayUniqueIPAddress.push(IPAddressFormated);
            }			
        });
		
		console.log("Foram encontrados " + arrayUniqueIPAddress.length + " IP's únicos.");

        //#############################################################################################################
        //CONSULTA AS ISPS DOS IPS
        //#############################################################################################################
        console.log('Consultado dados dos IPs em uma API pública:');

        $.each(arrayUniqueIPAddress, function( index, IPValue ){       
            let request = {
                method: 'GET',
                //uri: 'https://ipwhois.app/json/'+ IPValue + '?objects=ip,country,region,city,isp&lang=pt-BR'
				uri: 'http://localhost:3000/'+ IPValue
            }
            arrayRequests.push(request);
        });
		
		var count = 0;
        let rq = new RequestQueue(1);
        rq.on('resolved', res => {
			count++;
			var pct = Math.round(count/arrayUniqueIPAddress.length*100);
            console.log('Resultado consulta (' + pct + '%): ' + res);
            arrayIPResult.push(res);
        }).on('rejected', err => {
            console.log('Ocorreu um erro ao buscar dados de um IP!');
        }).on('completed', () => {

            //#############################################################################################################
            //CRIA EXCEL COM O RESULTADO FORMATADO
            //#############################################################################################################

            console.log('Criando Excel com todos os dados concatenados...');

            var workbook = new excel.Workbook();
            var worksheet = workbook.addWorksheet('Planilha1');
            var style = workbook.createStyle({
                font: {
                color: '#000000',
                size: 12
                }
            });    

            $.each(arrayIPDateFormated, function( index, value ){       
                worksheet.cell(parseInt(index)+1,1).string(value).style(style);
            });

            $.each(arrayIPHourFormated, function( index, value ){       
                worksheet.cell(parseInt(index)+1,2).string(value).style(style);
            });

            $.each(arrayIPAddressFormated, function( index, value ){
                var ipValue = value;
                var asn = "";
                var country = "";
                var regionName = "";
                var city = "";            

                for(var i=0; i<arrayIPResult.length; i++) {
                    var objResult = JSON.parse(arrayIPResult[i]);

                    if(ipValue == objResult.ip) {
                        asn = objResult.asn;
                        country = objResult.country;
                        regionName = objResult.regionName;
                        city = objResult.city;
                        break;
                    }
                }

                worksheet.cell(parseInt(index)+1,3).string(ipValue).style(style);
                worksheet.cell(parseInt(index)+1,4).string(asn).style(style);
                worksheet.cell(parseInt(index)+1,5).string(country).style(style);
                worksheet.cell(parseInt(index)+1,6).string(regionName).style(style);
                worksheet.cell(parseInt(index)+1,7).string(city).style(style);
            });       

            workbook.write("Resposta.xlsx", res);

        });
        rq.pushAll(arrayRequests);

    } catch(err) {
        console.log(err);
        res.status(500);
        res.send(err);
    }
})

module.exports = processFile