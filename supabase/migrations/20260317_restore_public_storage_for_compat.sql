begin;

update storage.buckets
set public = true
where id in ('temp-uploads', 'user-images', 'user-videos');

commit;
