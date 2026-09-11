package com.jugomo.miplancha

import org.junit.Assert.*
import org.junit.Test

class UsernameEmailTest {

    @Test public final fun todoMinuscula(
    ) : Unit {
        val companyId = "vgx32";
        val username = "julio123 ";

        val email = UsernameEmail.syntheticEmail(companyId, username);

        assertEquals("julio123@vgx32.miplancha.local", email);
    }

    @Test
    public final fun todoMayuscula(
    ) : Unit {
        val companyId = " Vgx32";
        val username = "Julio123";

        val email = UsernameEmail.syntheticEmail(companyId, username);

        assertEquals("julio123@vgx32.miplancha.local", email);
    }

}
