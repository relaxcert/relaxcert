English | [中文](./README_zh.md)

**Automated SSL certificate and renewal tool. Register and receive 100 points, which can be used for free for 7 months.** 
 
1. Easy to use, just need to execute one line of code to complete.
2. No intrusion, no change to the original configuration.
3. Automated renewal. After one execution, there is no need for manual intervention in the future.

## 1.Get Command Line

Open the console website. https://cert.relaxcert.com.

Directly log in to the system using a Google account.

After logging in, you can see the following command line information.

![](https://relaxcert.com/assets/1728637356808.BzHO3sl9.png)



## 2.Execute Command

Copy the command line and run it in the SSH connection tool.

If this is your first time running the command, you can see error output similar to the following.

![](https://relaxcert.com/assets/1728639540014.DIaB_ysq.png)

## 3.Configure domain name resolution

At this point, you need to go to the domain console provided by the domain provider and configure DNS resolution records according to the table above. When configuring, please fill in values without quotation marks. Please refer to the [Domain Name Verification] section (./domain name verification. html) for specific domain name resolution operations for each domain name provider.

After completing the domain name resolution configuration, please wait for 1 minute and then execute the command line at the beginning again for verification. If the same error still exists, please carefully check if the domain name resolution is configured correctly. If it is confirmed that the domain name resolution configuration is correct, the command needs to be run multiple times until the certificate application is successful. The effective time for domain name resolution varies depending on the domain name provider or region.

After completing these steps, the certificate renewal configuration is complete. Afterwards, if the Nginx configuration remains unchanged, no further action is required and the certificate will automatically renew before expiration.

It should be noted that do not delete the completed DNS resolution configuration, otherwise it will cause the next automatic certificate renewal to fail.


## 4.Special configuration (not mandatory)

Optional configuration (this step is only required for special needs)

>Configuration file path: /usr/.relaxcert/conf/conf.json
> ```json
>{
>   "exclude":[],
>   "include":[],
>   "domain":{}
>}
>```
> exclude: The domain name for applying for the certificate is empty by default, which does not exclude any domain name. Example, exclude: ["www.example. com", "www.example. org"].
>
> include: Temporarily reserved.
>
> domain: Domain name configuration, default to empty Object, meaning no domain name is configured. For example:
>>   ``` json
>>  {
>>     "www.abc.com":{
>>        "cert_only":true, 
>>        "single_domain":true
>>     },
>>     "sub.abc.com":{
>>        "cert_only":true, 
>>        "single_domain":true
>>     }
>>  }
>>  ```
>>  cert_only: Should I only apply for a certificate and not submit the domain name to the console for site monitoring. Default is false. After applying for a certificate, submit the domain name to the console for site monitoring. When configuring true, only certificates will be applied for and the domain name will not be submitted to the console for site monitoring.
>>
>>  single_domain: Whether to apply for a single domain name certificate, default is false, that is, to apply for a generic domain name certificate.
>


## 5. For more other functions, please log in to the console.

Open the console website. https://cert.relaxcert.com.
   
Support Windows IIS, automatic deployment and renewal of cloud service certificates, certificate and site monitoring, etc.


