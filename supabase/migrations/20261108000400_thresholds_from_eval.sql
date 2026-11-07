-- Replace the placeholder thresholds with the ones scripts/eval.py recommended on the raw
-- DogFaceNet photos (docs/EVALUATION.md, run "dogfacenet-raw-pipeline"). They are still provisional:
-- public data is not Bali field data. Only rows nobody has edited yet are changed.
update public.app_config
set value = '0.667',
    note = 'Sementara: dari evaluasi DogFaceNet (bukan data Bali), lihat docs/EVALUATION.md.'
where key = 'match_strong' and note like 'Sementara: belum dikalibrasi%';

update public.app_config
set value = '0.39',
    note = 'Sementara: dari evaluasi DogFaceNet (bukan data Bali), lihat docs/EVALUATION.md.'
where key = 'match_unsure' and note like 'Sementara: belum dikalibrasi%';
