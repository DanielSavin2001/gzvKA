<script>
    import {Footer, FooterCopyright, FooterLink, FooterLinkGroup} from "flowbite-svelte"

    let currentYear = new Date().getFullYear();

    import smits_logo from '$lib/images/footer/Smits-Belgium-Logo.jpg';
    import dirk_logo from '$lib/images/footer/Logo-Dirk-Van-Laer.jpg';



</script>


<Footer footerType="logo" class="center">
    <hr class="my-6 border-gray-300 sm:mx-auto dark:border-gray-700 lg:my-8"/>

    <FooterLinkGroup
            ulClass="flex flex-wrap items-center mb-6 text-sm text-gray-500 sm:mb-0 dark:text-gray-400 justify-around">
        <a href="https://www.smitsbelgium.be/" class="center"><img class="center"
                                                                   src="{smits_logo}"
                                                                   height="80" width="100"
                                                                   alt="Smits-Belgium-Logo"/></a>
        <a href="https://www.dirkvanlaerbvba.be/" class="center"><img class="center"
                                                                      src="{dirk_logo}"
                                                                      height="70" width="330"
                                                                      alt="Logo-Dirk-Van-Laer"/></a>
    </FooterLinkGroup>

</Footer>

<Footer class=" sticky bottom-0 left-0 z-20 w-full">

    <FooterCopyright href="/" by="gzvKA" year={currentYear}/>

    <FooterLinkGroup
            ulClass="flex flex-wrap items-center mt-3 text-sm text-gray-500 dark:text-gray-400 sm:mt-0"
    >
        <FooterLink href="/">Over ons</FooterLink>
        <FooterLink href="/">Contact</FooterLink>
    </FooterLinkGroup>

</Footer>
