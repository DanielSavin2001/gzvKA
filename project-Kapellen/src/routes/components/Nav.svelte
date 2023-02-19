<script>
    import {
        Navbar,
        NavBrand,
        NavLi,
        NavUl,
        NavHamburger,
        Dropdown,
        DropdownItem,
        Chevron,
        DropdownDivider
    } from 'flowbite-svelte'

    import logo_no_background from '$lib/images/logo/svg/logo-no-background.svg';
    import flag_of_kapellen from '$lib/images/logo/kapellen-flag/Flag_of_Kapellen,_Belgium.svg';

</script>
<style>

</style>

<Navbar color="light" navClass="px-2 sm:px-4 py-2.5 sticky w-full z-20 top-0 left-0 border-b"
        let:hidden
        let:toggle
>
    <NavBrand href="/">
        <img src="{logo_no_background}" class="mr-6 h-20" alt="gzvKA logo"/>
        <img src="{flag_of_kapellen}" class="mr-6 h-20" alt="gzvKA logo"/>
    </NavBrand>
    <NavHamburger on:click={toggle}/>
    <NavUl {hidden}>
        <NavLi href="/">Startpagina</NavLi>
        <NavLi id="nav-menu1" class="cursor-pointer">
            <Chevron aligned>Plaatsen</Chevron>
        </NavLi>

        <NavLi id="nav-menu2" class="cursor-pointer">
            <Chevron aligned>Geschiedenis en Erfgoed</Chevron>
        </NavLi>

        <NavLi id="nav-menu3" class="cursor-pointer">
            <Chevron aligned>Cultuur</Chevron>
        </NavLi>

        <NavLi id="nav-menu4" class="cursor-pointer">
            <Chevron aligned>Mensen en Gemeenschap</Chevron>
        </NavLi>

        <Dropdown triggeredBy="#nav-menu1" class="w-44 z-20">
            <DropdownItem href="/Kapellen">Kapellen</DropdownItem>
            <DropdownItem href="/">Putte</DropdownItem>
            <DropdownDivider/>
            <DropdownItem href="/">Alle straten</DropdownItem>
        </Dropdown>

        <Dropdown triggeredBy="#nav-menu2" class="w-44 z-20">
            <DropdownItem>De mythe van de "Pancras"</DropdownItem>
            <DropdownItem>Fort van Ertbrand</DropdownItem>
            <DropdownItem>Fort van Kapellen</DropdownItem>
            <DropdownItem>Historische Kaarten</DropdownItem>
            <DropdownItem>Kastelen in Kapellen</DropdownItem>
            <DropdownItem>Kerken en kapellen</DropdownItem>
            <DropdownItem>Louwke Poep</DropdownItem>
            <DropdownItem>Molens in Kapellen</DropdownItem>
            <DropdownItem>Oud Gemeentehuis</DropdownItem>
        </Dropdown>

        <Dropdown triggeredBy="#nav-menu3" class="w-44 z-20">
            <DropdownItem>Feesten in Kapellen</DropdownItem>
            <DropdownItem>Muziek in Kapellen</DropdownItem>
            <DropdownItem>Postkaarten uit Kapellen</DropdownItem>
            <DropdownItem>Sport in Kapellen</DropdownItem>
            <DropdownItem>Straffe Verhalen</DropdownItem>
            <DropdownItem>Wedstrijden GZVKA</DropdownItem>
        </Dropdown>

        <Dropdown triggeredBy="#nav-menu4" class="w-44 z-20">
            <DropdownItem>Jeugdjaren in Kapellen</DropdownItem>
            <DropdownItem>Klasfoto's Kapellen</DropdownItem>
            <DropdownItem>Mensen uit Kapellen</DropdownItem>
            <DropdownItem>Nieuwjaarsdrink 2015</DropdownItem>
        </Dropdown>

        <NavLi href="/">Over ons</NavLi>
        <NavLi href="/">Contact</NavLi>

    </NavUl>
</Navbar>