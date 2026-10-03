import sys, os, json, correction_boards as CB
CB.LOCAL = (sys.argv[1] == 'local')
os.makedirs('cout', exist_ok=True)
jobs = []
for name, fn, h in CB.BOARDS:
    html = fn()
    if CB.LOCAL:
        p = os.path.abspath(f'_{name}.html')
        open(p, 'w').write(html)
        jobs.append([p, os.path.abspath(f'cout/{name}.png'), 2400, h, 1])
    else:
        open(f'cout/{name}.dc.html', 'w').write(html)
json.dump(jobs, open('cout/jobs.json', 'w'))
print(len(CB.BOARDS))
