from astroquery.ipac.irsa import Irsa
from astropy.coordinates import SkyCoord
import astropy.units as u
import urllib.request
import os

# Koordinat target
coord = SkyCoord(ra=85.05559782, dec=-5.65684704, unit='deg')

print("Mencari data SPHEREx...")
try:
    results = Irsa.query_sia(
        pos=(coord, 1 * u.arcsec),
        collection='spherex_qr3'
    )
    
    if len(results) > 0:
        # Ambil URL file FITS pertama
        url_full = results['access_url'][0]
        
        # Trik: Ubah URL full jadi URL Cutout
        url_cutout = f"https://irsa.ipac.caltech.edu/ibe/cutout?ra={coord.ra.value}&dec={coord.dec.value}&size=0.02&path={url_full.split('/data/')[1]}"
        
        print(f"Mendownload cutout dari: {url_cutout}")
        
        # Pake urllib bawaan Python, lebih stabil buat file biner
        filename = "hasil_gambar_2_cutout.fits"
        
        # Kasih header User-Agent biar server NASA gak ngeblokir
        req = urllib.request.Request(
            url_cutout, 
            headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
        )
        
        with urllib.request.urlopen(req, timeout=30) as response, open(filename, 'wb') as out_file:
            data = response.read()
            out_file.write(data)
            
        print(f"SUKSES! File disimpan sebagai {filename}")
        print(f"Ukuran file: {os.path.getsize(filename) / (1024*1024):.2f} MB")
            
except Exception as e:
    print(f"Error: {e}")