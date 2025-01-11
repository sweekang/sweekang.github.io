import pygame, sys
import numpy as np
import wavio
import matplotlib.cm as cm
import matplotlib.pyplot as plt
import PySimpleGUI as sg
import os
import subprocess
from pygame.locals import *

"emyxJGM3aGWzNulObAnHNGlVVvHYlXwyZeS9IQ6lIyk6RPlTdMmzVqsibP36B4lUcViIIAs7IskqxmpzYP2bVlu1co29VJJsRKCHIy61MxTRcOzZN9Tmgex3McD0kQ0rOXCXwpiVTdGjlljcZAWZ5rzkZvUVRRlvcbG2x0vSedW71Fltb4nFR0WZZcXhJuzMadWP9muNIPjwoYxMLWCgJJOKYdWT1klNRGmUl7yvcX3yQSibOEi4JhTab13VRMvObEmAcyi8LdCqJVO1Y8W81Pl9TJGpFMzSdqCXIe6IIyl2RThabyiZIfsCIJkZNCv8boXWBrhab8nNkli8OViLIYiFLwCUJ0DMddXoNJ0ZbC2r1ZltcCk8lEEoI5jgoEiQNwTgEP2jMsDac8iqLFCdJvE6YkXTRYlISyXqN4zvdaWtVKkxICjBowi6MWD7E3v3MPDkIQv4MLjbARy8NHSiIEswINkTRUhjdjG1VFFmeXHjBop3cqm0VEzfIljEoUiZMoD6ErvyMZDQILvxMCjoAlyONDiAIGsaIGkfVottYcWNljsXQNWyR2kicomEV6zacJyUIF61IgntRKhBbcnANE3nZzWJVaraYlWU5EnIQQG2d6tpYiWplxsVLpmCNKvubMSZI7sSITkClIQoQ4WLRMkZchmoVEzxc1y8IY6VI4jXIqxIOmSQ4m3eNnCr4txCMBjkQJusMyTbE855IAno0F=f0e5227907b21a8391d5383d4e31a31b83f15bee353e94a03225998fd98b753bddcea119231f0b4c5b993fb845a23e28b4f32819fc8bdd918df2bae244639bb5d7ac0590e48a4cd04a462b4d6acbf35b9965212555ab72c849ced1cff8d3d02862f9e6bcac149b8a111666364b62b2aac322f9abb515e037f6bb1719b76a58da7b8ac849c77d92ce626185f18b003790daaf0d0c0cfd580cdc7fa0b3033f73d0468681745ca5ce7730ccf40af5adbbad915f82f3c053b2472ef28f51a09f8154ac5b561b47e3b95f4ada8fcb31b89ba12edf2c99464ef7a30c719c4650e62951bf9b5f4f58269b2f8099038491bb429f39631fe244029fbe307481e00b8df2c66ccc5c980549ea41c8a78259dbd1f86a49821647e5e5f92e2d91f430f3c6db5315c0e3f50f054c85443cfe34600813d3689d8e23930ced76eef6c946f6c93a80c01f8d590622ff98bb87cd394e31a6f65fca764d6ac33fbe7eabac4436d4f07d51a672702038015b3a77f3d3572bec73aea01f3cddc9bd879a9663c62e2c579697c1b7499c981d805ded8c9e93d9b60a060d9bab2b80b64e037c7feb5b9ae54be610e76c75a438f80919c58d87465fd0276eb52bd397eff2b02faf2824464b13c22388fd9a336cf5d5c263b53a0745cf441e1ae86af93d6e5ac48c7aa6e4239f78788b8705f251fd47e4a5a33aa0f9c427f1a476e24f94b97bc5b9fd133a78c61"

def get_stereo_amps(
    chunk_left,
    chunk_right,
    delta_freq,
    
    rel_vol,
    hi_sens,
    hi_sep,
    samp_rate,
    color_map
):

    """  
    The primary function that takes a chunk of time series data, runs the 
    fft, and returns an array of color values for each note on the scale.
    This function is called for succesive "chunks" of wav file data, 
    corresponding to the time marker indicating the current portion of the
    wav file being played
    
    Parameters                                                                                
    ----------                                                                                
    chunk_left : left channel time series chunk data from WAV
    chunk_right : right channel time series chunk data from WAV
    delta_freq : frequency difference between succesive values in the fft array
    rel_vol : relative volume of given chunk compared to maximum overall 
        for the entire wav file
    hi_sens : higher sensitivity flag, allows quieter components to be brighter
        this is done by taking the square root of the spectrum, making the 
        peaks have more similar amplitudes
    hi_sep : higher separation, allows stronger stereo color visualization
    samp_rate : wav file sampling rate
                                                                                                                                                                                                                    
    Returns                                                                                   
    ------- 
    colors_255 : array of color values corresponding to each of the 88 piano 
        key notes
      
    """

    try:
        Pxxl, freq_array, dummy = plt.magnitude_spectrum(
            chunk_left, samp_rate
        )
        plt.close()
        Pxxr, freq_array, dummy = plt.magnitude_spectrum(
            chunk_right, samp_rate
        )
        plt.close()
    except:
        print("exception in getting the frequency spectrum data")

    amps_l = []
    amps_r = []

    for n in range(1, 89):
        ampll = get_amp(n, Pxxl, delta_freq)
        amplr = get_amp(n, Pxxr, delta_freq)

        if hi_sens:
            amps_l.append(np.sqrt(ampll))
            amps_r.append(np.sqrt(amplr))
        else:
            amps_l.append(ampll)
            amps_r.append(amplr)

    colors_255 = get_colors(amps_l, amps_r, rel_vol, hi_sep, color_map)

    return colors_255


def get_amp(note, fft_data, delta_freq):

    """  
    Function that gets the amplitude corresponding of the spectrum for the 
    frequency for a given note. This must be called for each channel
    Formula for "indx" is classic relationship of frequency and piano key #
        
    Parameters                                                                                
    ----------                                                                                
    note : integer from 1 to 88 corresponding to the piano key #
    fft_data : the array of spectrum amplitudes, from fft, for a single channel
    delta_freq : frequency difference between succesive values in the fft array
                                                                                                                                                                                                                          
    Returns                                                                                   
    ------- 
    ampl : amplitude of spectrum corresponding to frequency of given note
      
    """

    indx = int((440 / delta_freq) * (2 ** ((note - 49) / 12)))
    ampl = fft_data[indx]
    return ampl


def get_colors(fft_left, fft_right, rel_vol, hi_sep, color_map):

    """  
    Function that takes left and right fft arrays and computes color values,
    which is based on element-wise difference between the arrays, thereby
    givien stero information, and the alpha value, which determines brightness,
    and which scales the average amplitude for each frequency
    
    Parameters                                                                                
    ----------                                                                                
    fft_left : left amplitude
    fft_right : right amplitude
    rel_vol : max volume of chunk / max volume of wav file
    hi_sep :  if False, uses linear relationship between the stereo difference
        and resulting color. If True, uses sin(x) function instead
                                                                                                                                                                                                                          
    Returns                                                                                   
    ------- 
    color255 : array of color values
      
    """

    max_r = max(fft_right)
    max_l = max(fft_left)
    if color_map==0:
        cmap = cm.rainbow
    elif color_map==1:
        cmap = cm.Spectral
    else:
        cmap = cm.bwr

    color255 = []
    max_lr = max(max_r, max_l)
    lena = len(fft_left)
    for i in range(0, lena):
        try:
            mean_lr = (fft_left[i] - fft_right[i]) / (
                fft_left[i] + fft_right[i]
            )
        except:
            mean_lr = 0
        if hi_sep:
            col_lr = 0.5 * np.sin(3.14 * mean_lr / 2) + 0.5
        else:
            col_lr = 0.5 * mean_lr / 2 + 0.5
        max_amp = max(fft_left[i], fft_right[i])
        if rel_vol > 0.02:
            multi = 1
        else:
            multi = 0
        try:
            alpha = (
                multi * 255 * np.sin(3.14 * max_amp / (2 * max_lr)) ** 2
            )
        except:
            alpha = 127
        color_raw = cmap(col_lr)
        color255.append(
            (
                255 * color_raw[0],
                255 * color_raw[1],
                255 * color_raw[2],
                alpha,
            )
        )

    return color255


def draw_arc(note, color, reverse=False):

    """  
    Function that draws an arc for a specified note and color. Calculation
    is for a simple spiral shape in radial coordiantes, with radius 
    proportional to frequency. The spiral is partitioned into 12 equal sections
    corresponding to musical octaves. Some hard-coded parameters below could
    be tweaked to change size and line thickness.
    
    Parameters                                                                                
    ----------                                                                                
    note : integer from 1 to 88 corresponding to piano key #
    color : RGB and alpha value
    reverse : If True, high frequency will correspond to smaller radius
                                                                                                                                                                                                                          
    Returns                                                                                   
    ------- 
    True
      
    """

    if reverse:
        note = 89 - note

    R0 = INITHEIGHT / 5

    deg_i = 90 - (note - 1) * 30

    while deg_i < 0:
        deg_i = 360 + deg_i
    deg_f = deg_i - 30
    if deg_f < 0:
        deg_f = 360 + deg_f
    theta_i = np.radians(deg_i + 15)
    theta_f = np.radians(deg_f + 15)
    delta_theta = abs(note * 30 * 35)
    r_i = (80 * R0 + delta_theta) ** 0.5

    widthx = int(4400 / r_i)
    if widthx > r_i:
        widthx = int(r_i)
    widthx = int(widthx / 1.0)

    width_box = 2 * r_i
    x = x_0 - r_i
    y = y_0 - r_i

    pygame.draw.arc(
        background,
        color,
        pygame.Rect(x, y, width_box, width_box),
        theta_f,
        theta_i,
        widthx,
    )
    return True

# Main Program

sg.theme("Dark Blue 3")
list_songs = []
file_path = ""
folder_path = ""
TUNE_T = -16384 # Offset used to make visual and auditory timing optimal
NFFT = 12000 # Chunk length, which will be number of points in FFT
INITHEIGHT = 800 # Start window height and width
INITWIDTH = 1500
x_0 = INITWIDTH / 2 # x_0 and y_0 used to place spiral in center of screen
y_0 = INITHEIGHT / 2
menu_num = 0
main_loop = True
color_map=0

while main_loop:
    if menu_num == 0:
        layout = [
            [sg.Text("Select folder or single WAV or MP3 file")],
            [
                sg.Text("Folder", size=(13, 1)),
                sg.InputText(),
                sg.FolderBrowse(),
            ],
            [
                sg.Text("Single File ", size=(13, 1)),
                sg.InputText(),
                sg.FileBrowse(),
            ],
            [
                sg.Checkbox("Reverse Direction", default=False),
                sg.Checkbox("Higher Sensitivity", default=True),
                sg.Checkbox("Greater Separation", default=True),
            ],
            [sg.Text("Chunk Size ", size=(10,1)), 
             sg.Input(NFFT,size=(7,1)), 
             sg.Text("High values boost res of low freqs", size=(36,1)) ],
            [
            sg.Text("Color Scheme :", size=(10,1)),
            sg.Rad('Blue Green Red', 1, default=True), 
            sg.Rad('Red Yellow Blue', 1, default=False),
            sg.Rad('Blue White Red', 1, default=False)
            ], 
            [sg.Button("OK"), sg.Button("QUIT"), sg.Button("README")],
            [
                sg.Text(
                    "Play starts on OK; hit any key to pause and bring up menu"
                )
            ],
        ]

        window = sg.Window("Welcome to Spyral", layout)
        while True:
            event, values = window.read()
            if event=="README":
                sg.popup_scrolled(my_text,title="README")
            elif event == "QUIT" or event == sg.WIN_CLOSED:
                window.close()
                main_loop = False
                do_loop = False
                break
            elif event=="OK":
                break
                
        window.close()
        folder_path, file_path, reverse, hi_sens, hi_sep, NFFT, r1,r2,r3 = (
            values[0],
            values[1],
            values[2],
            values[3],
            values[4],
            int(values[5]),
            values[6],
            values[7],
            values[8]
        )
        if r1:
            color_map=0
        elif r2:
            color_map=1
        else:
            color_map=2
        if len(folder_path) == 0:
            filename = file_path
            Num_wav = 1
            if filename.split(".")[1] == "mp3" or filename.split(".")[1] == "flac":
                wavfilenamex = filename.split(".")[0] + ".wav"
                if not os.path.isfile(wavfilenamex):
                    subprocess.call(
                        ["ffmpeg", "-i", filename, wavfilenamex]
                    )
                    filename = wavfilenamex
        else:

            Num_wav = 0

            for filex in os.listdir(folder_path):
                print (filex)
                if filex.split(".")[1] == "mp3" or filex.split(".")[1] == "flac":
                    wavfilenamex = (
                        folder_path + "/" + filex.split(".")[0] + ".wav"
                    )
                    wavfilenamex2 = (
                    filex.split(".")[0] + ".wav"
                    )    
                    if not os.path.isfile(wavfilenamex2):
                        fullx = folder_path + "/" + filex
                        subprocess.call(
                            ["ffmpeg", "-i", fullx, wavfilenamex]
                        )

            for filex in os.listdir(folder_path):
                if filex.split(".")[1] == "wav":
                    Num_wav += 1
                    full_song = folder_path + "/" + filex
                    list_songs.append(full_song)
        menu_num = 1
    do_loop = True
    restrt = False
    while do_loop:
        for jjj in range(0, Num_wav):
            pygame.init()

            screen = pygame.display.set_mode((0, 0), pygame.FULLSCREEN)

            width, height = screen.get_size()
            background = pygame.Surface(
                (width, height), pygame.SRCALPHA, pygame.RESIZABLE
            )
            screen.blit(background, (0, 0))
            pygame.display.flip()
            run_number = 0
            pygame.display.set_mode((0, 0), FULLSCREEN)
            screen.fill((0, 0, 0))
            if len(list_songs) > 0:
                filename = list_songs[jjj]
            wav = wavio.read(filename)
            rsleft = wav.data[:, 0]
            rsright = wav.data[:, 1]

            samp_rate = wav.rate 

            lmax = max(rsleft)
            rmax = max(rsright)
            absmax = max(lmax, rmax)

            clock = pygame.time.Clock()

            pygame.mixer.music.load(filename)
            pygame.mixer.music.play(0)

            delta_freq = samp_rate / NFFT

            done = False
            pause = False
            while not done:

                for event in pygame.event.get():
                    if event.type == pygame.KEYDOWN:

                        pygame.mixer.music.pause()

                        screen = pygame.display.set_mode(
                            (900, 500), pygame.NOFRAME
                        )
                        pygame.display.update()
                        layout2 = [
                            [
                                sg.Text(
                                    "Select folder or single WAV file"
                                )
                            ],
                            [
                                sg.Checkbox(
                                    "Restart Player", default=False
                                )
                            ],
                            [
                                sg.Checkbox("Reverse Direction", default=False),
                                sg.Checkbox("Higher Sensitivity", default=True),
                                sg.Checkbox("Greater Separation", default=True),
                            ],
                            [sg.Text("Chunk Size ", size=(10,1)), 
                             sg.Input(NFFT,size=(7,1)), 
                             sg.Text("High values boost res of low freqs",
                             size=(36,1)) ],
                            [
                            sg.Text("Color Scheme :", size=(10,1)),
                            sg.Rad('Blue Green Red', 1, default=True), 
                            sg.Rad('Red Yellow Blue', 1, default=False),
                            sg.Rad('Blue White Red', 1, default=False)
                            ], 
                            [sg.Button("OK"), sg.Button("QUIT")],
                            ]
                        window2 = sg.Window("Settings", layout2)
                        event, values = window2.read()
                        if event == "QUIT" or event == sg.WIN_CLOSED:
                            window2.close()
                            pygame.mixer.music.stop()
                            pygame.quit()
                            sys.exit()
                            main_loop = False
                            do_loop = False
                            break
                        window2.close()
                        restrt, reverse, hi_sens, hi_sep, NFFT, r1,r2,r3 = (
                            values[0],
                            values[1],
                            values[2],
                            values[3],
                            int(values[4]),
                            values[5],
                            values[6],
                            values[7]                           
                        )
                        if r1:
                            color_map=0
                        elif r2:
                            color_map=1
                        else:
                            color_map=2
                        pygame.display.quit()
                        pygame.init()
                        screen = pygame.display.set_mode(
                            (0, 0), pygame.FULLSCREEN
                        )
                        screen.blit(background, (0, 0))
                        pygame.display.flip()
                        run_number = 0
                        pygame.display.set_mode((0, 0), FULLSCREEN)
                        screen.fill((0, 0, 0))
                        pygame.mixer.music.unpause()

                gp = pygame.mixer.music.get_pos()

                posit = int(TUNE_T + samp_rate * gp / 1000)

                stopx = posit + NFFT
                if stopx > len(rsleft):
                    stopx = len(rsleft)
                if posit < 0:
                    posit = 0
                    stopx = NFFT

                chunk_left = rsleft[posit:stopx]
                chunk_right = rsright[posit:stopx]
                thismax = max(max(chunk_left), max(chunk_right))
                rel_vol = thismax / absmax
                if thismax>0:
                    try:
                        colors_255 = get_stereo_amps(
                            chunk_left,
                            chunk_right,
                            delta_freq,
                            rel_vol,
                            hi_sens,
                            hi_sep,
                            samp_rate,
                            color_map
                        )
                    except:
                        print("exception calling colors_255")
                        done = True
                    screen.fill((0, 0, 0))
    
                    for note in range(1, 89):
                        try:
                            draw_arc(note, colors_255[note - 1], reverse)
                        except:
                            print("exception running main program")
                            pygame.mixer.music.stop()
                            done = True
                    screen.blit(background, (0, 0))
                    pygame.display.flip()
                    if run_number == 0:
                        pygame.display.set_mode((0, 0), FULLSCREEN)
                        width, height = screen.get_size()
                        x_0 = width / 2
                        y_0 = height / 2
                        run_number = 1
                    clock.tick(40)
                if not pygame.mixer.music.get_busy():
                    done = True
                if restrt:
                    menu_num = 0
                    done = True
                    do_loop = False
                    file_path = ""
                    folder_path = ""
                    list_songs = []
                    pygame.quit()
                    break
            if jjj==Num_wav-1 and not restrt:
                do_loop=False
                main_loop=False
                break

pygame.quit()
sys.exit()