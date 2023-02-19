<script>

    let count = 0;
        const imageModules = import.meta.glob(["$lib/images/history-images/**"]);

        for (const modulePath in imageModules) {
            imageModules[modulePath]().then(() => {
                count=count + 1;
            });
        }
</script>


<p>appesal <span>{count}</span></p>