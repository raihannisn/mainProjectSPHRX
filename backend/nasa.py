from astropy.io import fits
import matplotlib.pyplot as plt
import numpy as np

nama_file = 'level2_2025W36_2B_0696_1D1_spx_l2b-v20-2025-271-cutout.fits' 

try:
    print(f"Lagi di buka {nama_file}...")
    hdul = fits.open(nama_file)
    
    data_gambar = hdul[1].data 
    data_gambar = np.nan_to_num(data_gambar)

    # 3. Gambar dan simpan
    plt.figure(figsize=(10, 8))
    plt.imshow(data_gambar, cmap='afmhot', origin='lower') 
    plt.colorbar(label='Intensitas Cahaya')
    plt.title('Foto SPHEREx - Cutout')
    
    output_png = 'hasil_gambar.png'
    plt.savefig(output_png, dpi=300, bbox_inches='tight')
    print(f"SUKSES! Cek file {output_png}")

except Exception as e:
    print(f"Error: {e}")