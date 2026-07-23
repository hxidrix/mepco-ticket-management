# Operational Location Hierarchy

The active consumer location model is:

**Circle → Division → Sub-division**

Registration, consumer profiles, consumer ticket submission and filters, ticket details, automatic staff routing, staff access boundaries, reports, master-data administration, and Swagger use this hierarchy.

Existing records created under the earlier Circle/City model are preserved. Where an exact new location cannot be safely inferred, the migration assigns the record to **Other Division → Other Sub-division** inside its existing circle. Administrators can then correct it without losing history. The old city fields remain only as migration history and are not exposed by active APIs or forms.

## 1. Multan Circle

- Multan Cantt Division: Cantt, Nawan Sheher, Hasan Parwana, Industrial Estate
- Mumtazabad Division: Mumtazabad, Ghalla Mandi, Makhdoom Rashid, Qasba Maral
- Musa Pak Division: Gulgasht, Shamasabad, Hasanabad, Bosan Road, WAPDA Town
- Shah Rukn-e-Alam Division: Shah Rukn-e-Alam, New Multan, Manzoorabad, Gulberg, Piran Ghaib
- City Division: Multan City, Walayatabad, Pak Gate, Garden Town
- Shujabad Division: Shujabad Urban, Sikandar Abad, Raja Ram, Alipur Sadaat
- Jalalpur Pirwala Division: Jalalpur City, Jalalpur Rural, Shadan Lund

## 2. Khanewal Circle

- Khanewal Division: Khanewal Old, Civil Lines, Khanewal Kohna, Khanewal Rural
- Kabirwala Division: Kabirwala City, Kabirwala Rural, Sarai Sidhu, Makhdoompur Pahuran
- Mian Channu Division: Mian Channu City, Mian Channu Rural, Tulamba
- Jahanian Division: Jahanian City, Jahanian Rural, Thatha Sadiqabad

## 3. Vehari Circle

- Vehari Division: Vehari City, Faisal Town, Thingi, Ludden
- Burewala Division: Burewala City, Satellite Town, Azimabad, Madina Town, Haji Sher
- Mailsi Division: Mailsi-I, Mailsi-II, Tibba Sultanpur, Sardar Pur Jhandir

## 4. Sahiwal Circle

- Sahiwal 1st Division: Sahiwal City, Sahiwal Urban, Farid Town, Sahiwal Rural
- Sahiwal 2nd Division: Yousafwala, Kameer, Harappa
- Chichawatni Division: Chichawatni City, Chichawatni Rural, Okanwala, Kassowal
- Pakpattan Division: Pakpattan City, Faridnagar, Pakpattan Rural
- Arifwala Division: Arifwala City, Arifwala Rural, Qaboola

## 5. Dera Ghazi Khan (D.G. Khan) Circle

- D.G. Khan Division: D.G. Khan-I, D.G. Khan-II, Fort Manro, Ghazi, Sakhi Sarwar, Quetta Road, Shah Sadar Din
- Kot Chutta Division: Kot Chutta City, Chotti, Sangam Chowk
- Taunsa Sharif Division: Taunsa City, Taunsa Rural, Vohwa, Shadan Lund, Tibi Qaisrani
- Rajanpur Division: Rajanpur City, Kot Mithan, Fazilpur, Rojhan
- Jampur Division: Jampur City, Gulshan Abad, Dajal

## 6. Muzaffargarh Circle

- Muzaffargarh Division: Muzaffargarh City, Muzaffargarh Rural, Khangarh, Shah Jamal
- Kot Addu Division: Kot Addu City, Kot Addu Rural, Sanawan, Chowk Munda
- Alipur Division: Alipur City, Alipur Rural, Jatoi, Khairpur Sadat

## 7. Layyah Circle

- Layyah Division: Layyah City, Layyah Rural, Kot Sultan
- Chowk Azam Division: Chowk Azam City, Fatehpur, Chaubara
- Karor Lal Esan Division: Karor City, Karor Rural

## 8. Bahawalpur Circle

- Bahawalpur Division (Model Town): Abbasia, Satellite Town, Baghdad-ul-Jadeed
- Ahmedpur East Division: Ahmedpur City, Ahmedpur Rural, Uch Sharif
- Hasilpur Division: Hasilpur City, Hasilpur Rural, Khairpur Tamewali
- Lodhran Division: Lodhran City, Lodhran Rural
- Kahror Pacca Division: Kahror Pacca City, Kahror Pacca Rural
- Dunyapur Division: Dunyapur City, Dunyapur Rural

## 9. Bahawalnagar Circle

- Bahawalnagar Division: Bahawalnagar City, Minchinabad, Donga Bonga
- Chishtian Division: Chishtian City, Chishtian Rural, Dahranwala
- Haroonabad Division: Haroonabad City, Haroonabad Rural, Faqirwali
- Fort Abbas Division: Fort Abbas City, Fort Abbas Rural

## 10. Rahim Yar Khan Circle

- Rahim Yar Khan Division: RYK City, Smart Town, Gulshan-e-Iqbal, Jinnah, Chowk Bahawalpur
- Sadiqabad Division: Sadiqabad City, Sadiqabad Town, Ahmed Pur Lama (A.P.L), JDW
- Liaqatpur Division: Liaqatpur City, Allah Abad, Khanbela, Feroza
- Khanpur Division: Khanpur City, Khanpur Rural, Kot Samaba, Zahirpir

## Protected fallbacks

Every circle also contains **Other Division → Other Sub-division**. A global **Other** circle contains the same fallback. These protected records support safe migration and genuine cases that are not yet represented in the approved list; they cannot be deactivated through normal master-data administration.
